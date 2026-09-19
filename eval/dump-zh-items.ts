// Writes the Mandarin course items (hand-checked Simplified, Traditional, pinyin) for plain-Node eval scripts.
//   npx vite-node eval/dump-zh-items.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE } from './lib.mjs';
import { ZH_ITEMS } from '../src/content/zh/course';
writeFileSync(join(CACHE, 'zh-items.json'), JSON.stringify(ZH_ITEMS.map((i) => ({ text: i.text, hant: i.zh!.hant, py: i.zh!.py }))));
console.log(`${ZH_ITEMS.length} items`);
