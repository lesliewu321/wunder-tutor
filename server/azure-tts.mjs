// The teacher's backup voice: Azure's standard neural voices (Leslie, 2026-09-22: "add azure backup voice").
//
// The teacher is Gemini Live, chosen because it sounds like a real, friendly teacher. But it is a conversational model
// asked to read a line, and now and then it cannot give a clean take: it adds words, glitches, or says a Mandarin tone
// the gate refuses. After three tries the line used to stay silent, and in the phone app there is no device voice to
// fall back on. A reading voice does none of that: it says exactly the text. So when the teacher cannot, this one does
// (server/tts.mjs). It uses the Speech resource and key of the scoring (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION), billed
// per character, and a take is kept like the teacher's, so each line is made once.
//
// Why not a second Google voice: the backup must not fail when the teacher does. Google refuses traffic from Hong Kong
// (see egress/), and a quota or an outage there would silence both at once.

/** One clear adult voice per language, like the teacher's (all offered in eastasia, checked 2026-09-22). */
export const BACKUP_VOICES = {
  'en-US': 'en-US-AvaNeural',
  'en-GB': 'en-GB-SoniaNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
  'es-ES': 'es-ES-ElviraNeural',
};

const XML = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => XML[c]);

/** The SSML for one take: the language's voice at a teacher's pace, slower still when the learner asks for slow. */
export function backupSsml({ text, accent, slow }) {
  const voice = BACKUP_VOICES[accent] ?? BACKUP_VOICES['en-US'];
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.slice(0, 5)}">`
    + `<voice name="${voice}"><prosody rate="${slow ? '-40%' : '-10%'}">${escapeXml(text)}</prosody></voice></speak>`;
}

/** The PCM and sample rate of a RIFF/WAVE file, walking its chunks (a header is not always 44 bytes). */
export function readWav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV');
  let rate = 24000;
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString('ascii', at, at + 4), size = buf.readUInt32LE(at + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(at + 12);
    if (id === 'data') return { pcm: buf.subarray(at + 8, Math.min(buf.length, at + 8 + size)), rate };
    at += 8 + size + (size & 1);
  }
  throw new Error('WAV without data');
}

/**
 * @param {{ key: string, region: string, fetchImpl?: typeof fetch, timeoutMs?: number }} opts
 * @returns {(req: { text: string, accent: string, slow?: boolean }) => Promise<{ pcm: Buffer, rate: number }>}
 */
export function createBackupVoice({ key, region, fetchImpl = (url, init) => fetch(url, init), timeoutMs = 15_000 }) {
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  return async (req) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        signal: ctl.signal,
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          // The teacher's own format: 24 kHz 16-bit mono, so both voices are one kind of take everywhere after this.
          'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
          'User-Agent': 'wunder-tutor',
        },
        body: backupSsml(req),
      });
      if (!res.ok) throw new Error(`azure tts ${res.status}`);
      return readWav(Buffer.from(await res.arrayBuffer()));
    } finally {
      clearTimeout(timer);
    }
  };
}
