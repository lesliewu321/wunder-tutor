// Entry point: npx vite-node eval/report-zh.ts [--cv] [--misses]
import { report } from './run-zh';
const argv = process.argv.join(' ');
report({ cv: argv.includes('--cv'), misses: argv.includes('--misses') });
