// Do generated likely-mistake spellings ("Fank you!", "wery") work as alternatives? Audio of each version is
// scored against both texts; the swapped word should fit its own audio clearly better.
//
// Result (2026-09-19, margin 7): no false alarm in either locale — on a correct take the respelling never fit
// better. On mistake takes US caught wery, sree, blead, fwies (not fank, sank, meelk, de, epple — partly Gemini
// "correcting" the respelling as it spoke); British caught only wery and blead: its scorer rates fank/sank 99 on a
// correct "Thank you", which is why British takes also lean on the US scorer (azureProvider.ts, dual scoring).
import { assess, pool, take, wav16k } from './lib.mjs';
const PAIRS: [string, string, number][] = [
  ['Thank you!', 'Fank you!', 0], ['Thank you!', 'Sank you!', 0], ['very', 'wery', 0], ['I am very hungry.', 'I am wery hungry.', 2],
  ['three', 'sree', 0], ['milk', 'meelk', 0], ['Could I have the menu, please?', 'Could I have de menu, please?', 3], ['apple', 'epple', 0],
  ['bread', 'blead', 0], ['fries', 'fwies', 0],
];
const word = (j: any, i: number) => { const w = (j?.NBest?.[0]?.Words ?? []).filter((x: any) => (x.ErrorType ?? x.PronunciationAssessment?.ErrorType) !== 'Insertion')[i]; return w ? (w.AccuracyScore ?? w.PronunciationAssessment?.AccuracyScore) : null; };
for (const locale of ['en-US', 'en-GB']) {
  const rows = await pool(PAIRS, 3, async ([good, bad, wi]: [string, string, number]) => {
    const [g, b] = [await take({ text: good, locale }), await take({ text: bad, locale })];
    const gw = wav16k(g.pcm, g.rate), bw = wav16k(b.pcm, b.rate);
    const [gg, gb, bg, bb] = await Promise.all([assess({ wav: gw, reference: good, locale }), assess({ wav: gw, reference: bad, locale }), assess({ wav: bw, reference: good, locale }), assess({ wav: bw, reference: bad, locale })]);
    // Correct take: alt must NOT win by the margin. Mistake take: alt must win by the margin.
    return `${bad.padEnd(34)} correct take: real ${word(gg, wi)} vs alt ${word(gb, wi)} | mistake take ("${b.transcript}"): real ${word(bg, wi)} vs alt ${word(bb, wi)}`;
  });
  console.log(`\n${locale}\n${rows.join('\n')}`);
}
