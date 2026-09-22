import { Navigate, useNavigate } from 'react-router-dom';
import { syncNow, useAccount } from '../../account/account';
import { useT } from '../../i18n/useT';
import { useProfile } from '../../state/store';
import { Button, TopBar } from '../../ui/kit';
import { SignInForm } from './AccountPanel';

/**
 * "I already have an account", from the first screen: sign in on this device, and the account's learner comes here
 * (accountLearner, src/account/sync.ts). Only an account that exists: accounts are made in Settings, with consent.
 */
export function SignIn() {
  const { t } = useT();
  const nav = useNavigate();
  const account = useAccount();
  // The account's learner has arrived — or this device has a learner already, whose account is in Settings.
  if (useProfile()) return <Navigate to="/" replace />;

  const signedIn = account.status === 'signed-in';
  const stuck = signedIn && (account.sync === 'failed' || account.sync === 'offline');
  // Saved, and still no learner: the account is empty (its learner was deleted). Setting up gives it one.
  const empty = signedIn && account.sync === 'saved';
  return (
    <div className="screen signin">
      <TopBar title={t('signin.title')} onBack={() => nav('/welcome')} />
      {!signedIn ? <SignInForm /> : (
        <div className="form-card form-card--pad">
          <p className={stuck ? 'access access--bad' : 'access access--ok'} role="status">
            {stuck ? t(account.sync === 'offline' ? 'settings.account.sync.offline' : 'settings.account.sync.failed') : t(empty ? 'signin.empty' : 'signin.loading', { email: account.email ?? '' })}
          </p>
          {stuck && <Button variant="soft" icon="retry" block onClick={() => void syncNow()}>{t('settings.account.syncNow')}</Button>}
          {empty && <Button block onClick={() => nav('/welcome')}>{t('signin.setUp')}</Button>}
        </div>
      )}
    </div>
  );
}
