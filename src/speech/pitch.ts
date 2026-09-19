// On-device pitch tracking (YIN), used to check Mandarin tones.
//
// The speech scorer grades the sounds of a syllable but is inconsistent about its tone (a 1st tone read as a 3rd
// scored 86 in our probes), so tones are judged from the child's own pitch. Pure functions over PCM samples:
// they run in the browser on the recording and in Node for the accuracy test set.

export interface PitchTrack {
  /** Seconds between frames. */
  hop: number;
  /** F0 per frame in Hz; 0 where the frame is unvoiced or unreliable. */
  f0: Float32Array;
}

export interface PitchOptions {
  minHz?: number;
  maxHz?: number;
  /** Cost of calling a loud frame unvoiced (vs. the YIN aperiodicity of its best candidate). */
  unvoicedCost?: number;
  /** Cost per octave of pitch change between neighbouring frames — what keeps the path continuous. */
  octaveCost?: number;
  /** Cost of switching between voiced and unvoiced. */
  voicingCost?: number;
}

interface Candidate { f: number; cost: number }

/**
 * Pitch track in two steps, as in Praat's path finder:
 *  1. every 10 ms, YIN (20 ms window — tone movements are fast) proposes several periods with their aperiodicity;
 *  2. a best-path search picks one candidate per frame (or "unvoiced"), trading aperiodicity against jumps.
 * A single frame's "best" guess is often an octave off at the creaky end of a tone; the path is not.
 */
export function trackPitch(samples: Float32Array, sampleRate: number, opts: PitchOptions = {}): PitchTrack {
  const minHz = opts.minHz ?? 70;
  const maxHz = opts.maxHz ?? 700;
  const unvoicedCost = opts.unvoicedCost ?? 0.45;
  const octaveCost = opts.octaveCost ?? 1.2;
  const voicingCost = opts.voicingCost ?? 0.3;
  const hop = Math.round(sampleRate * 0.01);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.ceil(sampleRate / minHz);
  const win = Math.round(sampleRate * 0.02);
  const frames = Math.max(0, Math.floor((samples.length - win - tauMax) / hop) + 1);
  const rms = new Float32Array(frames);
  const d = new Float32Array(tauMax + 2);

  let maxRms = 0;
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    let e = 0;
    for (let j = 0; j < win; j++) e += samples[start + j] * samples[start + j];
    rms[f] = Math.sqrt(e / win);
    if (rms[f] > maxRms) maxRms = rms[f];
  }
  const silent = Math.max(0.003, maxRms * 0.05);

  // 1. Candidates.
  const cands: Candidate[][] = [];
  for (let f = 0; f < frames; f++) {
    const list: Candidate[] = [];
    if (rms[f] >= silent) {
      const start = f * hop;
      d[0] = 1;
      let running = 0;
      for (let tau = 1; tau <= tauMax + 1 && start + win + tau <= samples.length; tau++) {
        let sum = 0;
        for (let j = 0; j < win; j++) { const diff = samples[start + j] - samples[start + j + tau]; sum += diff * diff; }
        running += sum;
        d[tau] = running > 0 ? (sum * tau) / running : 1;
      }
      for (let tau = tauMin; tau <= tauMax; tau++) {
        if (!(d[tau] < 0.6 && d[tau] <= d[tau - 1] && d[tau] <= d[tau + 1])) continue;
        const a = d[tau - 1], b = d[tau], c = d[tau + 1];
        const den = a - 2 * b + c;
        const t = den > 0 ? tau + (a - c) / (2 * den) : tau;
        list.push({ f: sampleRate / t, cost: b });
      }
      list.sort((x, y) => x.cost - y.cost);
      list.length = Math.min(list.length, 6);
    }
    cands.push(list);
  }

  // 2. Best path (Viterbi). State k < n = candidate k; state n = unvoiced.
  const back: Int16Array[] = [];
  let prevCost: number[] = [];
  let prevCands: Candidate[] = [];
  for (let f = 0; f < frames; f++) {
    const list = cands[f];
    const uCost = list.length ? unvoicedCost : 0;
    const cost: number[] = new Array(list.length + 1);
    const from = new Int16Array(list.length + 1);
    const local = [...list.map((c) => c.cost), uCost];
    for (let k = 0; k <= list.length; k++) {
      if (f === 0) { cost[k] = local[k]; from[k] = -1; continue; }
      let best = Infinity, arg = 0;
      for (let p = 0; p < prevCost.length; p++) {
        const pv = p < prevCands.length, kv = k < list.length;
        const trans = pv && kv ? octaveCost * Math.abs(Math.log2(list[k].f / prevCands[p].f)) : pv !== kv ? voicingCost : 0;
        const v = prevCost[p] + trans;
        if (v < best) { best = v; arg = p; }
      }
      cost[k] = best + local[k];
      from[k] = arg;
    }
    back.push(from);
    prevCost = cost;
    prevCands = list;
  }
  const f0 = new Float32Array(frames);
  if (frames) {
    let k = prevCost.indexOf(Math.min(...prevCost));
    for (let f = frames - 1; f >= 0; f--) {
      const list = cands[f];
      f0[f] = k < list.length ? list[k].f : 0;
      k = back[f][k];
    }
  }

  repairOctaves(f0);
  medianSmooth(f0, 3);
  dropShortRuns(f0, 3);
  return { hop: hop / sampleRate, f0 };
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Repair isolated octave slips against the frames around them. Only a frame that sits almost exactly an octave
 * away from its local neighbourhood is moved: Mandarin tones and children's voices legitimately span more than an
 * octave within one take (a 4th tone can start at 400 Hz in a 200 Hz voice), so the take's overall median is no
 * guide.
 */
function repairOctaves(f0: Float32Array): void {
  // Whole voiced stretches first: after a short gap (a consonant, a creak) the path may restart an octave off.
  let lastEnd = -1;
  let lastVal = 0;
  let i0 = 0;
  while (i0 < f0.length) {
    if (!f0[i0]) { i0++; continue; }
    let j = i0;
    while (j < f0.length && f0[j]) j++;
    if (lastEnd >= 0 && i0 - lastEnd <= 12 && lastVal) {
      const head = median(Array.from(f0.subarray(i0, Math.min(j, i0 + 4))));
      const r = head / lastVal;
      const fix = r > 1.7 && r < 2.35 ? 0.5 : r > 0.42 && r < 0.59 ? 2 : 1;
      if (fix !== 1) for (let k = i0; k < j; k++) f0[k] *= fix;
    }
    lastEnd = j - 1;
    lastVal = median(Array.from(f0.subarray(Math.max(i0, j - 4), j)));
    i0 = j;
  }
  const src = Float32Array.from(f0);
  for (let i = 0; i < f0.length; i++) {
    if (!src[i]) continue;
    const near: number[] = [];
    for (let j = Math.max(0, i - 6); j <= Math.min(f0.length - 1, i + 6); j++) if (j !== i && src[j]) near.push(src[j]);
    if (near.length < 3) continue;
    const local = median(near);
    const r = src[i] / local;
    if (r > 1.75 && r < 2.3) f0[i] = src[i] / 2;
    else if (r > 0.43 && r < 0.57) f0[i] = src[i] * 2;
  }
}

function medianSmooth(f0: Float32Array, width: number): void {
  const src = Float32Array.from(f0);
  const h = width >> 1;
  for (let i = 0; i < f0.length; i++) {
    if (!src[i]) continue;
    const win: number[] = [];
    for (let j = Math.max(0, i - h); j <= Math.min(f0.length - 1, i + h); j++) if (src[j]) win.push(src[j]);
    f0[i] = median(win);
  }
}

/** Isolated voiced blips are almost always tracking errors. */
function dropShortRuns(f0: Float32Array, minLen: number): void {
  let i = 0;
  while (i < f0.length) {
    if (!f0[i]) { i++; continue; }
    let j = i;
    while (j < f0.length && f0[j]) j++;
    if (j - i < minLen) for (let k = i; k < j; k++) f0[k] = 0;
    i = j;
  }
}

/** Semitones relative to 100 Hz — pitch as the ear hears it, so tone shapes compare across voices. */
export const semitones = (hz: number): number => 12 * Math.log2(hz / 100);

/** Voiced semitone values between two times (seconds). */
export function segment(track: PitchTrack, from: number, to: number): { t: number; st: number }[] {
  const out: { t: number; st: number }[] = [];
  const a = Math.max(0, Math.floor(from / track.hop));
  const b = Math.min(track.f0.length - 1, Math.ceil(to / track.hop));
  for (let i = a; i <= b; i++) if (track.f0[i] > 0) out.push({ t: i * track.hop, st: semitones(track.f0[i]) });
  return out;
}

/** The speaker's typical pitch in this take: median of all voiced frames, in semitones. */
export function speakerMedian(track: PitchTrack): number | null {
  const v = Array.from(track.f0).filter((x) => x > 0).map(semitones);
  return v.length >= 8 ? median(v) : null;
}

/** This take's pitch: its median and how far it spread (10th–90th percentile), in semitones. */
export function voiceStats(track: PitchTrack | null | undefined): { median: number; spread: number } | null {
  if (!track) return null;
  const v = Array.from(track.f0).filter((x) => x > 0).map(semitones).sort((a, b) => a - b);
  if (v.length < 8) return null;
  const q = (p: number) => v[Math.min(v.length - 1, Math.round(p * (v.length - 1)))];
  return { median: median(v), spread: q(0.9) - q(0.1) };
}
