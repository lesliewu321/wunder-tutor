import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InviteCodeForm } from '../features/profile/InviteCodeForm';
import { LANGUAGES, loadLanguage, setLanguage, t } from '../i18n';
import type { ApiHealth } from '../speech/health';
const base: ApiHealth = { azure: true, claude: false, gemini: true, ttsVersion: 'test', needsCode: true, authorized: true, codeSet: true, read: true, reached: true, family: true, plan: 'beta', codeAccepted: false };
const render = (patch: Partial<ApiHealth> = {}) => renderToStaticMarkup(<InviteCodeForm services={{ ...base, ...patch }} onServices={() => {}} />);
const savedCode = (code: string) => vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'wunder-tutor/access-code' ? code : null });
beforeAll(async () => { await Promise.all(LANGUAGES.map(l => loadLanguage(l.id))); });
afterEach(() => { vi.unstubAllGlobals(); setLanguage('en'); });
describe('invite form distinguishes account access from code acceptance', () => {
  it.each(LANGUAGES)('$id does not claim an empty field contains an accepted code', ({ id }) => {
    setLanguage(id); savedCode('');
    const html = render();
    expect(html).toContain(t('settings.beta.accountAccess'));
    expect(html).toContain(t('settings.beta.optional'));
    expect(html).not.toContain(t('settings.beta.accepted'));
    expect(html).toMatch(/<button[^>]*disabled/);
  });
  it('does not accept an invalid saved code merely because the account is entitled', () => {
    savedCode('invalid-code');
    const html = render();
    expect(html).toContain(t('settings.beta.accountAccess'));
    expect(html).toContain(t('settings.beta.refused'));
    expect(html).not.toContain(t('settings.beta.accepted'));
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });
  it('only marks the saved code accepted when the server explicitly validated it', () => {
    savedCode('fixture-valid-code');
    const html = render({ family: false, plan: null, codeAccepted: true });
    expect(html).toContain(t('settings.beta.accepted'));
    expect(html).not.toContain(t('settings.beta.accountAccess'));
    expect(html).toMatch(/<button[^>]*disabled/);
  });
  it('does not infer code acceptance from an older server response', () => {
    savedCode('fixture-code');
    expect(render({ codeAccepted: undefined })).not.toContain(t('settings.beta.accepted'));
  });
});
