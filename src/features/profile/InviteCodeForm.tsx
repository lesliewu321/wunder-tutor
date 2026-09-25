import { useState } from 'react';
import { dateLocale, type Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { getAccessCode, redeemInvite, refreshHealth, type ApiHealth, type InviteAnswer } from '../../speech';
import { Button } from '../../ui/kit';
import { normalCode } from '../../speech/health';

/**
 * The invite code: typed, checked with the server, which gives this device a place on it, and the answer shown as it
 * came — the places taken and the closing date (the urgency Leslie wanted), or exactly why it was turned away. In
 * Settings, and in setup before the speaking check (Leslie, 2026-09-22: without a code the teacher was silent there,
 * on a screen with no way out).
 */
export function InviteCodeForm({ services, onServices }: { services: ApiHealth; onServices: (h: ApiHealth) => void }) {
  const { t } = useT();
  const [code, setCode] = useState(getAccessCode);
  const [invite, setInvite] = useState<InviteAnswer | 'offline' | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const savedCode = getAccessCode();
  const changed = normalCode(code) !== savedCode;
  const codeAccepted = services.codeAccepted === true && !!savedCode && !changed;
  const accountAccess = services.authorized && services.family && (services.plan === 'beta' || services.plan === 'family');
  const betaMessage: Key = !services.reached ? 'settings.beta.unreachable'
    : changed && code.trim() ? 'settings.beta.unchecked' : codeAccepted ? 'settings.beta.accepted'
    : accountAccess && !code.trim() ? 'settings.beta.optional' : !services.codeSet ? 'settings.beta.noCodeSet'
    : changed ? 'settings.beta.prompt' : savedCode ? 'settings.beta.refused' : 'settings.beta.prompt';

  const submit = async () => {
    setRedeeming(true);
    setInvite(null);
    try {
      const answer = await redeemInvite(code);
      setInvite(answer);
      if (answer.ok) onServices(await refreshHealth());
    } catch {
      setInvite('offline');
    } finally {
      setRedeeming(false);
    }
  };
  const inviteDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) : '');
  const inviteLine = (a: InviteAnswer | 'offline'): { text: string; good: boolean } => {
    if (a === 'offline') return { text: t('settings.beta.unreachable'), good: false };
    const vars = { used: a.used ?? 0, places: a.places ?? 0, date: inviteDate(a.expiresAt) };
    switch (a.reason) {
      case 'new': return { text: t('settings.beta.invite.joined', vars), good: true };
      case 'again': return { text: t('settings.beta.invite.again'), good: true };
      case 'master': return { text: t('settings.beta.accepted'), good: true };
      case 'full': return { text: t('settings.beta.invite.full', vars), good: false };
      case 'expired': return { text: t('settings.beta.invite.expired', vars), good: false };
      case 'disabled': return { text: t('settings.beta.invite.disabled'), good: false };
      default: return { text: t('settings.beta.refused'), good: false };
    }
  };

  return (
    <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {accountAccess && <p className="access access--ok" role="status">{t('settings.beta.accountAccess')}</p>}
      {invite
        ? (() => { const line = inviteLine(invite); return <p className={line.good ? 'access access--ok' : 'access access--bad'} role="status">{line.text}</p>; })()
        : <p className={codeAccepted ? 'access access--ok' : 'access'} role="status">{t(betaMessage)}</p>}
      <label className="sr-only" htmlFor="access-code">{t('settings.beta.label')}</label>
      <input id="access-code" className="input" disabled={redeeming} value={code} onChange={(e) => { setCode(e.target.value); setInvite(null); }} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={t('settings.beta.placeholder')} />
      <Button type="submit" block disabled={redeeming || !code.trim() || codeAccepted}>{t(redeeming ? 'settings.beta.checking' : 'settings.beta.save')}</Button>
    </form>
  );
}
