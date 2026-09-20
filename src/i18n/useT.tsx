import { Fragment, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { t, tc, tn } from './index';

/**
 * In a component: `const { t } = useT();`. The functions are the same as the module's — the hook's job is to
 * re-render the component when the App language changes. Any component that shows wording calls it, even one that
 * only passes lines from helpers (feedback, tips).
 */
export function useT() {
  useStore((s) => s.settings.language);
  return { t, tn, tc };
}

/**
 * A translated line with **bold** parts: "It includes {name}’s age — **no name**." Only that one mark is understood,
 * so a translation can move the bold part anywhere in its sentence and nothing else can be slipped in.
 */
export function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}
