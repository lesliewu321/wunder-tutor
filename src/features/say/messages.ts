import { ReadError, type Reading } from '../../speech/read';

const ERRORS: Record<ReadError['code'], string> = {
  offline: 'No internet right now — try again when you’re back online.',
  busy: 'That was a lot of pages! Wait a few minutes, then try again.',
  unavailable: 'Reading pages needs the beta access code (Beta access in the settings).',
  photo: 'That photo couldn’t be opened. Take a new one, or choose a JPEG or PNG.',
  failed: 'The page couldn’t be read this time. Try again with the page flat, still and well lit.',
};

/** What to tell the learner when reading failed. The server's reason is added in brackets, for testers' screenshots. */
export const readErrorMessage = (e: unknown): string => {
  if (!(e instanceof ReadError)) return ERRORS.failed;
  return e.detail && e.code === 'failed' ? `${ERRORS.failed} (${e.detail})` : ERRORS[e.code];
};

/** A page with nothing to practise: why. Null when it has sentences. */
export const readingProblem = (r: Reading, kid: boolean): string | null =>
  r.language === 'none' || !r.lines.length
    ? (kid ? 'I couldn’t find any words. Hold the book closer, in good light.' : 'No text found. Hold the page closer, in good light.')
    : r.language === 'other' ? 'Wunder Tutor can check English and Putonghua for now.' : null;
