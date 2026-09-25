import { describe, expect, it } from 'vitest';
import { mergeProfiles } from '../account/merge';
import { useStore } from '../state/store';
import { dueTests, TEST_AFTER_MS, testDue } from '../engine/testing';

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

describe('when a test is due', () => {
  const DAY = 86_400_000;
  const unit = ['food-1', 'food-2', 'food-3'];
  const done = (at: number) => ({ completedAt: at, stars: 2, bestAvg: 80 });
  it('two days after a lesson, not before, and not again until the lesson is completed again', () => {
    const now = 10 * DAY;
    const p = { lessonsCompleted: { 'food-1': done(now - DAY) }, tests: {} };
    expect(testDue(p, 'food-1', unit, now)).toBe(false);
    expect(testDue(p, 'food-1', unit, now + TEST_AFTER_MS)).toBe(true);
    const tested = { ...p, tests: { 'food-1': { at: now + TEST_AFTER_MS, score: 70, best: 70, taken: 1 } } };
    expect(testDue(tested, 'food-1', unit, now + 5 * DAY)).toBe(false);
    const redone = { lessonsCompleted: { 'food-1': done(now + 6 * DAY) }, tests: tested.tests };
    expect(testDue(redone, 'food-1', unit, now + 9 * DAY)).toBe(true);
    expect(testDue({ lessonsCompleted: {}, tests: {} }, 'food-1', unit, now)).toBe(false);
  });
  it('the last lesson of a unit straight away once the unit is finished', () => {
    const now = 10 * DAY;
    const p = { lessonsCompleted: { 'food-1': done(now - 5 * DAY), 'food-2': done(now - 3 * DAY), 'food-3': done(now) }, tests: {} };
    expect(dueTests(p, unit, now)).toEqual(['food-1', 'food-2', 'food-3']);
    const part = { lessonsCompleted: { 'food-3': done(now) }, tests: {} };
    expect(dueTests(part, unit, now)).toEqual([]);
  });
});
