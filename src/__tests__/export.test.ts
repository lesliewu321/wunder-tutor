import { describe, expect, it } from 'vitest';
import type { Attempt, ChildProfile } from '../domain/types';
import { buildRecordingExport, CONSENT_TEXT, EXPORT_FORMAT, learnerCode, type RecordingExport } from '../data/exportRecordings';

const profile = { id: 'p-123', name: 'Tiger', age: 9, band: 'junior', homeLanguage: 'yue', accent: 'en-US', zhScript: 'hant' } as ChildProfile;
const attempt = (id: string, profileId: string, audioKey?: string): Attempt => ({
  id, profileId, itemId: 'zh-mian4-bao1', text: '面包', createdAt: Date.UTC(2026, 8, 19), audioKey, context: 'lesson',
  assessment: { provider: 'azure', referenceText: '面包', overall: 80, accuracy: 80, fluency: 90, completeness: 100, words: [], durationMs: 900 },
});

describe('sharing recordings for testing', () => {
  it('makes one nameless file with each recording as 16 kHz WAV, and the consent given', async () => {
    const stored: Record<string, Blob> = { a: new Blob(['webm-a']), b: new Blob(['webm-b']) };
    const wav = new Uint8Array([82, 73, 70, 70, 1, 2, 3]);
    const out = await buildRecordingExport(
      profile,
      [attempt('1', 'p-123', 'a'), attempt('2', 'p-123', 'gone'), attempt('3', 'someone-else', 'b'), attempt('4', 'p-123')],
      async (k) => stored[k], async () => new Blob([wav]), Date.UTC(2026, 8, 20),
    );
    expect(out.takes).toBe(1);
    expect(out.skipped).toBe(1); // a recording that was deleted
    expect(out.name).toBe(`wunder-tutor-recordings-${learnerCode('p-123')}-2026-09-20.json`);
    const text = await out.file.text();
    expect(text).not.toContain('Tiger');
    const data = JSON.parse(text) as RecordingExport;
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.consent.text).toBe(CONSENT_TEXT);
    expect(data.learner).toEqual({ code: learnerCode('p-123'), age: 9, band: 'junior', homeLanguage: 'yue', accent: 'en-US', zhScript: 'hant' });
    expect(data.takes[0]).toMatchObject({ itemId: 'zh-mian4-bao1', text: '面包', py: 'mian4 bao1', locale: 'zh-CN', context: 'lesson' });
    expect([...atob(data.takes[0].wav)].map((c) => c.charCodeAt(0))).toEqual([...wav]);
  });

  it('gives each learner a stable code that is not their id', () => {
    expect(learnerCode('p-123')).toBe(learnerCode('p-123'));
    expect(learnerCode('p-123')).not.toBe(learnerCode('p-124'));
    expect(learnerCode('p-123')).toMatch(/^L-[0-9A-Z]{6}$/);
  });
});
