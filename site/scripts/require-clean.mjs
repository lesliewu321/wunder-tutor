import { execFileSync } from 'node:child_process';
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  throw new Error('Deploy from a clean committed checkout. Use a clean worktree when unrelated work is in progress.');
}
