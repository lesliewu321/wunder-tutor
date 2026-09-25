import { useEffect, useState } from 'react';
import type { ApiHealth } from '../../speech/health';
import { noSoundMessage } from '../../speech/health';
import { automaticVoices, TEACHER_VOICES, teacherVoiceChoice, setTeacherVoiceChoice, isTeacherVoice, voiceSupports, voiceConfigured, type TeacherVoiceChoice } from '../../speech/teacherPreference';
import { voice } from '../../speech/voice';
import { useActiveProfile } from '../../state/store';
import { useT } from '../../i18n/useT';
import { Button, toast } from '../../ui/kit';
const NAMES = { azure: 'Azure Neural', qwen: 'Qwen', chirp: 'Google Chirp 3 HD', gemini: 'Gemini' };
const PREVIEWS = { yue: { text: '你好！我學緊廣東話。', accent: 'zh-HK' }, en: { text: 'Hello! I would like some water, please.', accent: 'en-US' }, zh: { text: '你好！很高兴认识你。', accent: 'zh-CN' }, ja: { text: 'こんにちは。よろしくお願いします。', accent: 'ja-JP' }, ko: { text: '안녕하세요. 만나서 반가워요.', accent: 'ko-KR' }, fr: { text: 'Bonjour ! Je suis ravi de vous rencontrer.', accent: 'fr-FR' }, es: { text: '¡Hola! Encantada de conocerte.', accent: 'es-ES' } } as const;
export function TeacherVoiceSelect({ services }: { services: ApiHealth | null }) {
  const { t } = useT();
  const profile = useActiveProfile();
  const [choice, setChoice] = useState(teacherVoiceChoice);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => voice.stop(), []);
  const name = (id: TeacherVoiceChoice) => id === 'auto' ? t('settings.voice.auto') : id === 'device' ? t('settings.demo.voice.device') : NAMES[id];
  const configured = (id: TeacherVoiceChoice) => voiceConfigured(id, services) && voiceSupports(id, profile.course === 'en' ? profile.accent : PREVIEWS[profile.course].accent);
  const preview = async () => {
    setPlaying(true);
    try { const line = PREVIEWS[profile.course]; await voice.speak(line.text, { accent: profile.course === 'en' ? profile.accent : line.accent }); }
    catch (e) { toast(await noSoundMessage(profile.band, e), '🔇'); }
    finally { setPlaying(false); }
  };
  return <>
    <label className="select-row"><span>{t('settings.demo.voice')}</span>
      <select aria-label={t('settings.demo.voice')} value={choice} onChange={e => { if (!isTeacherVoice(e.target.value)) return; voice.stop(); setPlaying(false); setTeacherVoiceChoice(e.target.value); setChoice(e.target.value); }}>
        {TEACHER_VOICES.map(id => <option key={id} value={id} disabled={!configured(id)}>{name(id)}{configured(id) ? '' : ' — ' + t(voiceSupports(id, profile.course === 'en' ? profile.accent : PREVIEWS[profile.course].accent) ? 'settings.voice.unavailable' : 'settings.voice.courseUnavailable')}</option>)}
      </select>
    </label>
    <p className="help" role="status">{t('settings.voice.selection', { voice: name(choice) })} {choice === 'auto' && services && t('settings.voice.automaticUses', { voice: name(automaticVoices(services, profile.course === 'en' ? profile.accent : PREVIEWS[profile.course].accent)[0] ?? 'device') })}</p>
    <p className="help">{t('settings.voice.choiceHint')}</p>
    <Button variant="ghost" disabled={playing || !configured(choice)} onClick={() => void preview()}>{t(playing ? 'settings.voice.playing' : 'settings.voice.preview')}</Button>
  </>;
}
