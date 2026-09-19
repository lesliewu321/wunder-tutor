// Entry point: npx vite-node eval/report-zh.ts [--cv] [--misses] [--cold] [--pooled]
import { report } from './run-zh';
const argv = process.argv.join(' ');
report({ cv: argv.includes('--cv'), misses: argv.includes('--misses'), speaker: argv.includes('--cold') ? 'cold' : argv.includes('--pooled') ? 'pooled' : 'profile' });
