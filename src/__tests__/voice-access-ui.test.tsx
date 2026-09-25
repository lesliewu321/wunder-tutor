import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeacherVoiceSelect } from '../features/profile/TeacherVoiceSelect';
vi.mock('../state/store', () => ({
  useActiveProfile: () => ({ course: 'yue', accent: 'en-US', band: 'adult' }),
  useStore: () => undefined,
}));
import { LANGUAGES, loadLanguage, setLanguage, t } from '../i18n';
import type { ApiHealth } from '../speech/health';

const health = (patch: Partial<ApiHealth> = {}): ApiHealth => ({ azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: true, authorized: false, codeSet: true, read: false, reached: true, voiceProviders: { azure: false, chirp: false, qwen: false, gemini: false }, ...patch });
const render = (h: ApiHealth | null) => renderToStaticMarkup(<TeacherVoiceSelect services={h} onRefresh={async () => {}} />);
const option = (html: string, provider: string) => html.match(new RegExp('<option[^>]*value="' + provider + '"[^>]*>[^<]*</option>'))![0];
beforeAll(async () => {
  await Promise.all(LANGUAGES.map(l => loadLanguage(l.id)));
});
afterAll(() => { setLanguage('en'); });

describe('voice access explanations', () => {
  it.each(LANGUAGES)('$id explains locked cloud voices and preserves course restrictions', ({ id }) => {
    setLanguage(id);
    const html = render(health());
    for (const provider of ['azure', 'chirp', 'qwen']) {
      expect(option(html, provider)).toContain('disabled');
      expect(option(html, provider)).toContain(t('settings.voice.accessRequired'));
    }
    expect(option(html, 'gemini')).toContain(t('settings.voice.courseUnavailable'));
    expect(option(html, 'device')).not.toContain('disabled');
    expect(html).toContain(t('settings.beta.title'));
    expect(html).toContain(t('settings.conn.again'));
    expect(html).not.toContain('settings.voice.');
  });
  it('separates loading, unreachable, and configured-but-locked states', () => {
    setLanguage('en');
    expect(option(render(null), 'chirp')).toContain('Checking');
    expect(option(render(health({ reached: false, needsCode: false })), 'chirp')).toContain('Check connection');
    expect(option(render(health()), 'chirp')).toContain('Invite code required');
  });
  it('enables Cantonese Chirp after authorization while leaving Gemini unavailable for the course', () => {
    const html = render(health({ authorized: true, voiceProviders: { azure: true, chirp: true, qwen: true, gemini: true } }));
    expect(option(html, 'chirp')).not.toContain('disabled');
    expect(option(html, 'gemini')).toContain('disabled');
    expect(html).not.toContain('Invite code required');
  });
  it('does not tell an authorized learner to enter a code for a missing provider', () => {
    const html = render(health({ authorized: true }));
    expect(option(html, 'chirp')).toContain('unavailable');
    expect(html).not.toContain('Invite code required');
  });
  it('explains missing server setup without suggesting a code can unlock it', () => {
    const html = render(health({ codeSet: false }));
    expect(html).toContain('no invite code set');
    expect(html).not.toContain('Invite code required');
  });
});
