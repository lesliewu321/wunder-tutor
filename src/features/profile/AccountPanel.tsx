import { useEffect, useState } from 'react';
import { sendCode, signInWithCode, signOut, syncNow, useAccount, type AccountError } from '../../account/account';
import type { ChildProfile } from '../../domain/types';
import { language, type Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { useActiveProfile } from '../../state/store';
import { Button } from '../../ui/kit';

// The learner's own account (one learner per account — Leslie, 2026-09-22): the learner's email address, a code from
// the email, and from then on the learner (progress, scores, the pages of My book — never recordings) is the same on
// every device. Under 18, a parent or guardian agrees first. Once payments exist, the parent's payment confirms it.

/** Bump when the consent wording changes: what was agreed to is recorded with its version and words. */
const CONSENT_VERSION = '2026-09-22';

const ERRORS: Record<AccountError, Key> = {
  email: 'settings.account.error.email', code: 'settings.account.error.code', wait: 'settings.account.error.wait',
  offline: 'settings.account.error.offline', unknown: 'settings.account.error.unknown', failed: 'settings.account.error.failed',
};
const SAVED: Record<'idle' | 'saving' | 'saved' | 'offline' | 'failed', Key> = {
  idle: 'settings.account.sync.idle', saving: 'settings.account.sync.saving', saved: 'settings.account.sync.saved',
  offline: 'settings.account.sync.offline', failed: 'settings.account.sync.failed',
};

/**
 * Email → code → signed in. With `learner` (Settings), that learner gets an account, with consent: a parent's for a
 * learner under 18, the learner's own for an adult. Without (the sign-in screen), only an account that exists.
 */
export function SignInForm({ learner }: { learner?: ChildProfile }) {
  const { t } = useT();
  const minor = !!learner && learner.band !== 'adult';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [parentAgrees, setParentAgrees] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountError | null>(null);
  const consent = learner ? t(minor ? 'settings.account.consent.parent' : 'settings.account.consent.adult', { name: learner.name }) : '';

  const run = async (work: () => Promise<AccountError | null>, then?: () => void) => {
    setBusy(true); setError(null);
    const problem = await work();
    setBusy(false);
    if (problem) setError(problem); else then?.();
  };

  if (sentTo) {
    return (
      <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); void run(() => signInWithCode(sentTo, code, learner ? { version: CONSENT_VERSION, language: language(), wording: consent } : null)); }}>
        <p className="access">{t('settings.account.sent', { email: sentTo })}</p>
        <label className="sr-only" htmlFor="account-code">{t('settings.account.code.label')}</label>
        {/* How long the code is, is a setting on the account server — 6 by default, 8 here, up to 10. So the app
            never names a length, and takes any of them: a pasted code is stripped to its digits and kept whole. */}
        <input id="account-code" className="input account__code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" placeholder={t('settings.account.code.placeholder')} />
        {error && <p className="access access--bad" role="alert">{t(ERRORS[error])}</p>}
        <Button type="submit" block disabled={busy || code.length < 6}>{t(busy ? 'settings.account.checking' : 'settings.account.signIn')}</Button>
        <div className="account__row">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(() => sendCode(sentTo, !!learner))}>{t('settings.account.resend')}</Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSentTo(null); setCode(''); setError(null); }}>{t('settings.account.otherEmail')}</Button>
        </div>
      </form>
    );
  }

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <form className="form-card form-card--pad" onSubmit={(e) => { e.preventDefault(); const to = email.trim(); void run(() => sendCode(to, !!learner), () => setSentTo(to)); }}>
      <p className="access">{learner ? t(minor ? 'settings.account.why.child' : 'settings.account.why.adult', { name: learner.name }) : t('signin.body')}</p>
      <label className="sr-only" htmlFor="account-email">{t(minor ? 'settings.account.email.child' : 'settings.account.email.label', { name: learner?.name ?? '' })}</label>
      <input id="account-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t('settings.account.email.placeholder')} />
      {/* Under 18: the account is the learner's, but a parent or guardian agrees to it — here, before any email goes. */}
      {minor && (
        <label className="switch-row account__parent">
          <input type="checkbox" checked={parentAgrees} onChange={(e) => setParentAgrees(e.target.checked)} />
          <span className="switch" aria-hidden />
          <span><b>{t('settings.account.parent.title')}</b> {consent}</span>
        </label>
      )}
      {error && <p className="access access--bad" role="alert">{t(ERRORS[error])}</p>}
      <Button type="submit" block disabled={busy || !valid || (minor && !parentAgrees)}>{t(busy ? 'settings.account.sending' : 'settings.account.send')}</Button>
      {learner && !minor && <p className="fineprint fineprint--left">{consent}</p>}
    </form>
  );
}

export function AccountPanel() {
  const { t } = useT();
  const account = useAccount();
  const p = useActiveProfile();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  // A fresh form (email step, nothing ticked) after signing out.
  useEffect(() => { if (account.status === 'signed-out') setKey((k) => k + 1); }, [account.status]);

  return (
    <section id="zone-account">
      <h2 className="section-title">{t('settings.account.title')}</h2>
      {account.status === 'signed-in' ? (
        <div className="form-card form-card--pad">
          <p className="access access--ok">{t('settings.account.signedIn', { email: account.email ?? '', name: p.name })}</p>
          <p className="account__saved" role="status">{t(SAVED[account.sync])}</p>
          {account.full && <p className="access">{t('settings.account.full')}</p>}
          <div className="account__row">
            {/* Saving is automatic. The button is only for when it did not happen (no internet, the account out of reach). */}
            {(account.sync === 'failed' || account.sync === 'offline') ? <Button variant="soft" size="sm" icon="retry" onClick={() => void syncNow()}>{t('settings.account.syncNow')}</Button> : <span />}
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setBusy(true); void signOut().finally(() => setBusy(false)); }}>{t('settings.account.signOut')}</Button>
          </div>
        </div>
      ) : <SignInForm key={`${key}-${p.id}`} learner={p} />}
    </section>
  );
}
