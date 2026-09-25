import { useActiveProfile } from '../../state/store';
import { BookHome } from './BookHome';

/** The Snap & say tab: the learner's book on a screen of its own (Home's second mode until 2026-09-25). */
export function BookTab() {
  const p = useActiveProfile();
  return <div className="screen book-screen"><BookHome p={p} /></div>;
}
