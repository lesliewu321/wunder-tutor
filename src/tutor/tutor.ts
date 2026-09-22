import { contentBand, type AgeBand, type SpeakItem } from '../domain/types';
import { sayLine, type Scenario } from '../content/scenarios';
import { apiFetch, fromHealth } from '../speech';

export interface TutorTurn { role: 'tutor' | 'child'; text: string }

export interface TutorReply {
  /** What the tutor says, as a line in the conversation's language. */
  reply: SpeakItem;
  /** Things the child could say next. Empty when the conversation is over. */
  suggestions: SpeakItem[];
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

/**
 * Live tutor through the server proxy (server/index.mjs → Claude), for English only: its brief and its safety rules
 * are written for an English partner, and a Mandarin line needs Traditional characters and exact pinyin that a
 * generated reply cannot be trusted to carry. Falls back to the script on any failure.
 */
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
      const j = (await res.json()) as { reply?: string; suggestions?: string[]; done?: boolean };
      if (!j.reply) throw new Error('empty reply');
      const scripted = await this.fallback.next(scenario, band, history);
      return {
        reply: sayLine(j.reply), done: !!j.done,
        suggestions: j.done ? [] : j.suggestions?.length ? j.suggestions.slice(0, 2).map(sayLine) : scripted.suggestions,
      };
    } catch {
      return this.fallback.next(scenario, band, history);
    }
  }
}

const scripted = new ScriptedTutor();
const live = fromHealth((h): ConversationTutor => (h.claude ? new ClaudeTutor() : scripted));

/** The partner for this scenario: the live tutor for English when the server has one, otherwise the script. */
export const getTutor = (scenario: Scenario): Promise<ConversationTutor> => (scenario.course === 'en' ? live() : Promise.resolve(scripted));
