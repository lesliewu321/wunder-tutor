import { useEffect, useState } from 'react';
import { sendCode, signInWithCode, signOut, syncNow, useAccount, type AccountError } from '../../account/account';
import { language, type Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { Button } from '../../ui/kit';

// The family's account, in the grown-ups' settings: an email address, a code from the email, and from then on the
// learners (progress, scores, the pages of My book — never recordings) are the same on every device of the family.

/** Bump when the wording under the email field changes: what was agreed to is recorded with its version and words. */
const CONSENT_VERSION = '2026-09-beta';

const ERRORS: Record<AccountError, Key> = {
  email: 'settings.account.error.email', code: 'settings.account.error.code', wait: 'settings.account.error.wait',
  offline: 'settings.account.error.offline', failed: 'settings.account.error.failed',
};
const SAVED: Record<'idle' | 'saving' | 'saved' | 'offline' | 'failed', Key> = {
  idle: 'settings.account.sync.idle', saving: 'settings.account.sync.saving', saved: 'settings.account.sync.saved',
  offline: 'settings.account.sync.offline', failed: 'settings.account.sync.failed',
};

export function AccountPanel() {
  const { t } = useT();
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountError | null>(null);
  useEffect(() => { if (account.status === 'signed-in') { setSentTo(null); setCode(''); setError(null); } }, [account.status]);

  const run = async (work: () => Promise<AccountError | null>, then?: () => void) => {
    setBusy(true); setError(null);
    const problem = await work();
    setBusy(false);
    if (problem) setError(problem); else then?.();
  };

  return (
    <section id="zone-account">
      <h2 className="section-title">{t('settings.account.title')}</h2>
      {account.status === 'signed-in' ? (
        <div className="form-card form-card--pad">
          <p className="access access--ok">{t('settings.account.signedIn', { email: account.email ?? '' })}</p>
          <p className="account__saved" role="status">{t(SAVED[account.sync])}</p>
          {account.full && <p className="access">{t('settings.account.full')}</p>}
          <div className="account__row">
            {/* Saving is automatic. The button is only for when it did not happen (no internet, the account out of reach). */}
            {(account.sync === 'failed' || account.sync === 'offline') ? <Button variant="soft" size="sm" icon="retry" onClick={() => void syncNow()}>{t('settings.account.syncNow')}</Button> : <span />}
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setBusy(true); void signOut().finally(() => setBusy(false)); }}>{t('settings.account.signOut')}</Button>
          </div>
        </div>
      ) : sentTo ? (
        <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); void run(() => signInWithCode(sentTo, code, { version: CONSENT_VERSION, language: language(), wording: t('settings.account.consent') })); }}>
          <p className="access">{t('settings.account.sent', { email: sentTo })}</p>
          <label className="sr-only" htmlFor="account-code">{t('settings.account.code.label')}</label>
          {/* How long the code is, is a setting on the account server — 6 by default, 8 here, up to 10. So the app
              never names a length, and takes any of them: a pasted code is stripped to its digits and kept whole. */}
          <input id="account-code" className="input account__code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" placeholder={t('settings.account.code.placeholder')} />
          {error && <p className="access access--bad" role="alert">{t(ERRORS[error])}</p>}
          <Button type="submit" block disabled={busy || code.length < 6}>{t(busy ? 'settings.account.checking' : 'settings.account.signIn')}</Button>
          <div className="account__row">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => sendCode(sentTo))}>{t('settings.account.resend')}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSentTo(null); setCode(''); setError(null); }}>{t('settings.account.otherEmail')}</Button>
          </div>
        </form>
      ) : (
        <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); const to = email.trim(); void run(() => sendCode(to), () => setSentTo(to)); }}>
          <p className="access">{t('settings.account.why')}</p>
          <label className="sr-only" htmlFor="account-email">{t('settings.account.email.label')}</label>
          <input id="account-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t('settings.account.email.placeholder')} />
          {error && <p className="access access--bad" role="alert">{t(ERRORS[error])}</p>}
          <Button type="submit" block disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>{t(busy ? 'settings.account.sending' : 'settings.account.send')}</Button>
          <p className="fineprint fineprint--left">{t('settings.account.consent')}</p>
        </form>
      )}
    </section>
  );
}
