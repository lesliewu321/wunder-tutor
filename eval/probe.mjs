// Feasibility probe: the unknowns that decide the Mandarin design and the English "heard as" feature.
import { assess, scores, take, wav16k, words } from './lib.mjs';

const show = (label, json) => {
  const s = scores(json);
  console.log(`\n=== ${label}: ${json.RecognitionStatus} acc=${s.acc} pron=${s.pron} pros=${s.pros ?? '—'}`);
  for (const w of words(json)) {
    console.log(`  ${String(w.word).padEnd(8)} ${String(w.score).padStart(4)} ${String(w.error).padEnd(17)} t=${(w.offset / 1e4).toFixed(0)}+${(w.duration / 1e4).toFixed(0)}ms  ph=[${w.phonemes.map((p) => `${p.ph || '∅'}:${p.score}${p.nbest.length ? ` {${p.nbest.join(' ')}}` : ''}`).join(' ')}]`);
  }
};

const zh = async (text, voice = 'Kore') => take({ text, locale: 'zh-CN', voice });
const run = async (label, audio, reference, locale, extra) => show(label, await assess({ wav: wav16k(audio.pcm, audio.rate), reference, locale, extra }));

// 1) US English: does NBestPhonemeCount work over REST (what was said instead)?
const free = await take({ text: 'free', locale: 'en-US' });
const three = await take({ text: 'three', locale: 'en-US' });
console.log(`[transcripts] free="${free.transcript}" three="${three.transcript}"`);
await run('en-US ref three / said free, nbest=5', free, 'three', 'en-US', { NBestPhonemeCount: 5 });
await run('en-US ref three / said three, nbest=5', three, 'three', 'en-US', { NBestPhonemeCount: 5 });

// 2) Mandarin: tone-only and segment-only substitutions
const mai3 = await zh('买'); const mai4 = await zh('卖');
const shi1 = await zh('诗'); const si1 = await zh('丝');
const ni3 = await zh('你'); const li3 = await zh('李');
const shui3 = await zh('水'); const shui2 = await zh('谁');
const ma1 = await zh('妈'); const ma3 = await zh('马'); const ma4 = await zh('骂');
console.log(`[transcripts] 买="${mai3.transcript}" 卖="${mai4.transcript}" 诗="${shi1.transcript}" 丝="${si1.transcript}" 你="${ni3.transcript}" 李="${li3.transcript}" 水="${shui3.transcript}" 谁="${shui2.transcript}" 妈="${ma1.transcript}" 马="${ma3.transcript}" 骂="${ma4.transcript}"`);

await run('zh ref 买 / said 买', mai3, '买', 'zh-CN');
await run('zh ref 买 / said 卖 (tone 3→4)', mai4, '买', 'zh-CN');
await run('zh ref 卖 / said 买 (tone 4→3)', mai3, '卖', 'zh-CN');
await run('zh ref 水 / said 谁 (tone 3→2)', shui2, '水', 'zh-CN');
await run('zh ref 妈 / said 马 (tone 1→3)', ma3, '妈', 'zh-CN');
await run('zh ref 马 / said 骂 (tone 3→4)', ma4, '马', 'zh-CN');
await run('zh ref 诗 / said 诗', shi1, '诗', 'zh-CN');
await run('zh ref 诗 / said 丝 (sh→s)', si1, '诗', 'zh-CN');
await run('zh ref 丝 / said 诗 (s→sh)', shi1, '丝', 'zh-CN');
await run('zh ref 你 / said 李 (n→l)', li3, '你', 'zh-CN');
await run('zh ref 诗 / said 丝, nbest=5', si1, '诗', 'zh-CN', { NBestPhonemeCount: 5 });

// 3) Phrases: tone-only error inside a phrase; Traditional reference text
const phraseBuy = await zh('我想买'); const phraseSell = await zh('我想卖');
await run('zh ref 我想买 / said 我想买', phraseBuy, '我想买', 'zh-CN');
await run('zh ref 我想买 / said 我想卖', phraseSell, '我想买', 'zh-CN');
const apple = await zh('我要吃苹果');
await run('zh ref Simplified 我要吃苹果', apple, '我要吃苹果', 'zh-CN');
await run('zh ref Traditional 我要吃蘋果', apple, '我要吃蘋果', 'zh-CN');
