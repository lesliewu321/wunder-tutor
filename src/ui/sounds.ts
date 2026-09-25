// Original two-note success chime, synthesized locally: no download or AI request.
// Called from the answer tap so mobile browsers can unlock audio. Device volume controls it.
let context: AudioContext | undefined;

export function playCorrect(): void {
  try {
    if (typeof window === 'undefined') return;
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === 'closed') context = new Audio();
    const ctx = context;
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    for (const [offset, frequency] of [[0, 1046.5], [0.09, 1568]]) {
      const tone = ctx.createOscillator();
      const volume = ctx.createGain();
      const start = now + offset;
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, start);
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.1, start + 0.008);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.23);
      tone.connect(volume);
      volume.connect(ctx.destination);
      tone.onended = () => { tone.disconnect(); volume.disconnect(); };
      tone.start(start);
      tone.stop(start + 0.25);
    }
  } catch {
    // Feedback must never block the answer when audio is unavailable.
  }
}
