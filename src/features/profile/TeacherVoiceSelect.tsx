import { useEffect, useRef, useState } from 'react';
import type { ApiHealth } from '../../speech/health';
import { getAccessCode, noSoundMessage, soundProblem } from '../../speech/health';
import { TEACHER_VOICES, teacherVoicePair, setTeacherVoicePair, resetTeacherVoicePair, hasTeacherVoiceOverride, isPlaybackVoice, voiceSupports, voiceConfigured, type TeacherVoice, type VoicePair } from '../../speech/teacherPreference';
import { voice } from '../../speech/voice';
import type { CourseId, Locale } from '../../domain/types';
import { useActiveProfile } from '../../state/store';
import { useT } from '../../i18n/useT';
import { Button, toast } from '../../ui/kit';
const NAMES = { azure: 'Azure Neural', qwen: 'Qwen', chirp: 'Google Chirp 3 HD', gemini: 'Gemini' };
const COURSES: CourseId[] = ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'];
const PREVIEWS = { yue: { text: '你好！我學緊廣東話。', accent: 'zh-HK' }, en: { text: 'Hello! I would like some water, please.', accent: 'en-US' }, zh: { text: '你好！很高兴认识你。', accent: 'zh-CN' }, ja: { text: 'こんにちは。よろしくお願いします。', accent: 'ja-JP' }, ko: { text: '안녕하세요. 만나서 반가워요.', accent: 'ko-KR' }, fr: { text: 'Bonjour ! Je suis ravi de vous rencontrer.', accent: 'fr-FR' }, es: { text: '¡Hola! Encantada de conocerte.', accent: 'es-ES' } } as const;
export function TeacherVoiceSelect({ services, onRefresh }: { services: ApiHealth | null; onRefresh: () => Promise<unknown> }) {
  const { t } = useT();
  const profile = useActiveProfile();
  const [course, setCourse] = useState(profile.course);
  const locale: Locale = course === 'en' ? profile.accent : PREVIEWS[course].accent;
  const [pair, setPair] = useState(() => teacherVoicePair(locale));
  const [playing, setPlaying] = useState<'primary' | 'backup' | null>(null);
  const [checking, setChecking] = useState(false);
  const previewId = useRef(0);
  const stop = () => { previewId.current++; voice.stop(); setPlaying(null); };
  useEffect(() => { stop(); setPair(teacherVoicePair(locale)); }, [locale]);
  useEffect(() => () => { previewId.current++; voice.stop(); }, []);
  const name = (id: TeacherVoice | 'none') => id === 'none' ? t('settings.voice.noBackup') : id === 'device' ? t('settings.demo.voice.device') : NAMES[id];
  const locked = !!services?.reached && services.needsCode && !services.authorized;
  const configured = (id: TeacherVoice) => voiceConfigured(id, services) && voiceSupports(id, locale);
  const unavailable = (id: TeacherVoice) => t(!voiceSupports(id, locale) ? 'settings.voice.courseUnavailable'
    : !services ? 'settings.conn.checking' : !services.reached ? 'settings.voice.connectionRequired'
    : locked && services.codeSet ? 'settings.voice.accessRequired' : 'settings.voice.unavailable');
  const save = (next: VoicePair) => { stop(); setTeacherVoicePair(locale, next); setPair(teacherVoicePair(locale)); };
  const refresh = async () => {
    setChecking(true);
    try { await onRefresh(); } finally { setChecking(false); }
  };
  const preview = async (slot: 'primary' | 'backup') => {
    const provider = pair[slot];
    if (provider === 'none') return;
    const mine = ++previewId.current;
    setPlaying(slot);
    try { await voice.speak(PREVIEWS[course].text, { accent: locale, provider }); }
    catch (e) { const message = await noSoundMessage(profile.band, e); if (mine === previewId.current) toast(message, '🔇'); }
    finally { if (mine === previewId.current) setPlaying(null); }
  };
  const options = (slot: 'primary' | 'backup') => TEACHER_VOICES.filter((id): id is Exclude<typeof id, 'auto'> => id !== 'auto').map(id =>
    <option key={id} value={id} disabled={!configured(id) || (slot === 'backup' && id === pair.primary)}>{name(id)}{configured(id) ? '' : ' — ' + unavailable(id)}</option>);
  return <div className="teacher-voices">
    <label className="select-row"><span>{t('settings.voice.course')}</span>
      <select aria-label={t('settings.voice.course')} value={course} onChange={e => {
        const next = e.target.value as CourseId;
        if (!COURSES.includes(next)) return;
        stop(); setCourse(next);
        setPair(teacherVoicePair(next === 'en' ? profile.accent : PREVIEWS[next].accent));
      }}>
        {COURSES.map(id => <option key={id} value={id}>{t(id === 'en' ? (profile.accent === 'en-GB' ? 'settings.me.course.enGB' : 'settings.me.course.enUS') : `settings.me.course.${id}`)}</option>)}
      </select>
    </label>
    <label className="select-row"><span>{t('settings.voice.primary')}</span>
      <select aria-label={t('settings.voice.primary')} value={pair.primary} onChange={e => {
        if (!isPlaybackVoice(e.target.value)) return;
        const primary = e.target.value;
        save({ primary, backup: pair.backup === primary ? pair.primary : pair.backup });
      }}>{options('primary')}</select>
    </label>
    <label className="select-row"><span>{t('settings.voice.backup')}</span>
      <select aria-label={t('settings.voice.backup')} value={pair.backup} onChange={e => {
        if (e.target.value === 'none' || isPlaybackVoice(e.target.value)) save({ ...pair, backup: e.target.value });
      }}><option value="none">{name('none')}</option>{options('backup')}</select>
    </label>
    <p className="help" role="status">{t(hasTeacherVoiceOverride(locale) ? 'settings.voice.customPair' : 'settings.voice.defaultPair')}</p>
    <p className="help">{t('settings.voice.pairHint')}</p>
    {pair.backup !== 'none' && <p className="help">{t('settings.voice.deviceFallbackHint')}</p>}
    {services && (locked || !services.reached) && <p className="help" role="status">{soundProblem(services, !!getAccessCode(), profile.band)}</p>}
    <div className="account__row">
      <Button variant="ghost" disabled={playing !== null || !configured(pair.primary)} onClick={() => void preview('primary')}>{t(playing === 'primary' ? 'settings.voice.playing' : 'settings.voice.previewPrimary')}</Button>
      <Button variant="ghost" disabled={playing !== null || pair.backup === 'none' || !configured(pair.backup)} onClick={() => void preview('backup')}>{t(playing === 'backup' ? 'settings.voice.playing' : 'settings.voice.previewBackup')}</Button>
    </div>
    <div className="account__row">
      <Button variant="ghost" onClick={() => { stop(); resetTeacherVoicePair(locale); setPair(teacherVoicePair(locale)); }}>{t('settings.voice.resetPair')}</Button>
      {locked && services.codeSet && <Button variant="ghost" onClick={() => {
        document.getElementById('zone-code')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        document.getElementById('access-code')?.focus({ preventScroll: true });
      }}>{t('settings.beta.title')}</Button>}
      <Button variant="ghost" disabled={checking} onClick={() => void refresh()}>{t(checking ? 'settings.conn.checking' : 'settings.conn.again')}</Button>
    </div>
  </div>;
}
