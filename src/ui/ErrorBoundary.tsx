import { Component, type ReactNode } from 'react';

/** Last line of defence: if a screen fails, say so and offer a way on — never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen screen--center gate" role="alert">
        <span className="gate__icon" aria-hidden>🛠️</span>
        <h1>Something went wrong</h1>
        <p>That screen couldn’t open. Your progress is safe.</p>
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => { window.location.href = '/'; }}>Go to the start</button>
      </div>
    );
  }
}
