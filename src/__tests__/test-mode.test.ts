import { describe, expect, it } from 'vitest';
import { mergeProfiles } from '../account/merge';
import { useStore } from '../state/store';

// Test mode: the same lesson without the teacher. What the store keeps of it, and how two devices agree on it.

const learner = () => useStore.getState().createProfile({ name: 'Tiger', avatar: '🐯', age: 9, homeLanguage: 'yue', level: 'some', goal: 'fun', accent: 'en-US', learning: ['en'] });

describe('a finished test', () => {

  it('records the score, keeps the best, counts the goes, and leaves the lesson as it was', () => {
    const id = learner();
    const first = useStore.getState().completeTest('food-1', 82);
    expect(first).toMatchObject({ score: 82, best: 82, taken: 1 });
    const second = useStore.getState().completeTest('food-1', 70);
    expect(second).toMatchObject({ score: 70, best: 82, taken: 2 });
    const p = useStore.getState().profiles[id];
    expect(p.tests?.['food-1']).toEqual(second);
    expect(p.lessonsCompleted['food-1']).toBeUndefined();
  });
});

describe('two devices', () => {
  it('keep the best score and the latest go', () => {
    const id = learner();
    const p = useStore.getState().profiles[id];
    const a = { ...p, tests: { 'food-1': { at: 10, score: 70, best: 82, taken: 2 } } };
    const b = { ...p, tests: { 'food-1': { at: 5, score: 90, best: 90, taken: 1 }, 'food-2': { at: 7, score: 60, best: 60, taken: 1 } } };
    const m = mergeProfiles(a, b);
    expect(m.tests).toEqual({ 'food-1': { at: 10, score: 70, best: 90, taken: 2 }, 'food-2': { at: 7, score: 60, best: 60, taken: 1 } });
    expect(mergeProfiles(p, p).tests).toBeUndefined();
  });
});
