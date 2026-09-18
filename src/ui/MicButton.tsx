import { forwardRef } from 'react';
import { Icon } from './Icon';

export type MicState = 'ready' | 'listening' | 'processing' | 'disabled';

const LABEL: Record<MicState, string> = {
  ready: 'Tap to speak',
  listening: 'Listening… tap when you’re done',
  processing: 'Checking your pronunciation',
  disabled: 'Microphone unavailable',
};

/**
 * The most important control in the app. Each state looks and moves differently so a child never
 * has to wonder whether recording started. The live input level arrives through the `--level`
 * CSS variable (set imperatively by the recorder) to avoid a React render per audio frame.
 */
export const MicButton = forwardRef<HTMLButtonElement, { state: MicState; onPress: () => void; size?: number }>(
  ({ state, onPress, size = 104 }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`mic mic--${state}`}
      style={{ width: size, height: size }}
      onClick={onPress}
      disabled={state === 'processing' || state === 'disabled'}
      aria-label={LABEL[state]}
      aria-pressed={state === 'listening'}
    >
      <span className="mic__halo" />
      <span className="mic__halo mic__halo--2" />
      <span className="mic__face">
        {state === 'processing' ? (
          <span className="mic__dots"><i /><i /><i /></span>
        ) : state === 'listening' ? (
          <span className="mic__bars"><i /><i /><i /><i /><i /></span>
        ) : (
          <Icon name="mic" size={size * 0.42} />
        )}
      </span>
    </button>
  ),
);
MicButton.displayName = 'MicButton';
