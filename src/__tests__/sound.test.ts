import { describe, expect, it } from 'vitest';
import { soundProblem, type ApiHealth } from '../speech/health';

const health = (h: Partial<ApiHealth>): ApiHealth => ({ azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: false, authorized: false, codeSet: true, read: false, ...h });
const WORKING = health({ needsCode: true, authorized: true, azure: true, gemini: true, read: true });

/**
 * A silent word used to get one answer — "Sound isn't working on this device right now" — whatever the reason. On a
 * phone that reads as a broken phone, and there is nothing left to try. It matters more in the phone app than on the
 * web: Android's WebView has no speechSynthesis, so the teacher's voice is the only voice, and its usual causes (no
 * invite code on a fresh install, an API out of reach) have nothing to do with the device.
 */
describe('why a word would not play', () => {
  it('sends a device that has never had the invite code to where a grown-up can enter it', () => {
    const child = soundProblem(health({ needsCode: true }), false, 'junior');
    expect(child).toMatch(/invite code/);
    expect(child).toMatch(/grown-up/);
    expect(child).toMatch(/Parent Zone/);
    // A grown-up learner is sent to their own settings, not to a parent.
    expect(soundProblem(health({ needsCode: true }), false, 'adult')).not.toMatch(/grown-up can/);
  });

  it('says so plainly when the code this device holds has stopped being accepted', () => {
    expect(soundProblem(health({ needsCode: true }), true, 'junior')).toMatch(/isn’t accepted any more/);
  });

  it('never asks anyone to type a code that could not work — a server with none set', () => {
    const text = soundProblem(health({ needsCode: true, codeSet: false }), true, 'junior');
    expect(text).toMatch(/no invite code set/);
    expect(text).not.toMatch(/Parent Zone/);
  });

  it('blames the connection, not the phone, when the API cannot be reached at all', () => {
    // An API that never answered looks exactly like this: nothing is known, so nothing is claimed about the device.
    expect(soundProblem(health({}), false, 'junior')).toMatch(/can’t be reached/);
    expect(soundProblem(health({ needsCode: true, authorized: true }), true, 'junior')).toMatch(/can’t be reached/);
  });

  it('only blames the device once the voice is known to be there', () => {
    expect(soundProblem(WORKING, true, 'junior')).toMatch(/this device/);
  });
});
