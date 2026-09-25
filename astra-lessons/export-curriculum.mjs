import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'astra-lessons/export-curriculum.test.ts'], { env: { ...process.env, CURRICULUM_EXPORT: '1' }, stdio: 'inherit' });
process.exit(result.status ?? 1);
