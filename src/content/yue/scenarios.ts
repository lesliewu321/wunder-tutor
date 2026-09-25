import data from '../../../astra-lessons/hk-cantonese/scenarios.json';
import type { Scenario } from '../scenarios';
import { YUE } from './course';
import type { ContentBand } from '../../domain/types';
const bands: ContentBand[] = ['little', 'junior', 'teen'];
export const YUE_SCENARIOS: Scenario[] = data.map(s => ({
 ...s, course: 'yue',
 turns: s.turns.map(t => ({
  tutor: Object.fromEntries(bands.map(b => [b, YUE.byId[t.tutor[b]]])) as Scenario['turns'][number]['tutor'],
  replies: Object.fromEntries(bands.map(b => [b, t.replies[b].map(id => YUE.byId[id])])) as Scenario['turns'][number]['replies'],
 })),
 closing: Object.fromEntries(bands.map(b => [b, YUE.byId[s.closing[b]]])) as Scenario['closing'],
}));
