import { Component, type ReactNode } from 'react';
import { t } from '../i18n';

/** Last line of defence: if a screen fails, say so and offer a way on — never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen screen--center error-screen" role="alert">
        <span className="error-screen__icon" aria-hidden>🛠️</span>
        <h1>{t('common.error.title')}</h1>
        <p>{t('common.error.body')}</p>
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => { window.location.href = '/'; }}>{t('common.error.reload')}</button>
      </div>
    );
  }
}
