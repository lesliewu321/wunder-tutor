import { contentBand, type AgeBand } from '../domain/types';
import type { Scenario } from '../content/scenarios';
import { apiFetch, apiHealth } from '../speech';

export interface TutorTurn { role: 'tutor' | 'child'; text: string }

export interface TutorReply {
  reply: string;
  /** Things the child could say next. Empty when the conversation is over. */
  suggestions: string[];
  done: boolean;
}

/** Conversation partner. The scripted tutor and the Claude-backed tutor are interchangeable. */
export interface ConversationTutor {
  readonly name: string;
  next(scenario: Scenario, band: AgeBand, history: TutorTurn[], pronunciationNotes?: string): Promise<TutorReply>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ScriptedTutor implements ConversationTutor {
  readonly name = 'scripted';

  async next(scenario: Scenario, band: AgeBand, history: TutorTurn[]): Promise<TutorReply> {
    await wait(500);
    const turn = history.filter((h) => h.role === 'child').length;
    const t = scenario.turns[turn];
    const b = contentBand(band);
    if (!t) return { reply: scenario.closing[b], suggestions: [], done: true };
    return { reply: t.tutor[b], suggestions: t.replies[b], done: false };
  }
}

/** Live tutor through the server proxy (server/index.mjs → Claude). Falls back to the script on any failure. */
export class ClaudeTutor implements ConversationTutor {
  readonly name = 'claude';
  private fallback = new ScriptedTutor();

  async next(scenario: Scenario, band: AgeBand, history: TutorTurn[], pronunciationNotes?: string): Promise<TutorReply> {
    try {
      const res = await apiFetch('/api/tutor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: { title: scenario.title, setting: scenario.setting, tutorRole: scenario.tutorRole, goals: scenario.goals },
          band, history, pronunciationNotes,
        }),
      });
      if (!res.ok) throw new Error(`tutor ${res.status}`);
      const j = (await res.json()) as TutorReply;
      if (!j.reply) throw new Error('empty reply');
      const scripted = await this.fallback.next(scenario, band, history);
      return { reply: j.reply, done: !!j.done, suggestions: j.done ? [] : j.suggestions?.length ? j.suggestions.slice(0, 2) : scripted.suggestions };
    } catch {
      return this.fallback.next(scenario, band, history);
    }
  }
}

let tutor: Promise<ConversationTutor> | null = null;
export const getTutor = (): Promise<ConversationTutor> => {
  tutor ??= apiHealth().then((h) => (h.claude ? new ClaudeTutor() : new ScriptedTutor()));
  return tutor;
};
