import type { Language } from '../i18n';
import { AuthClient, type Session } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { ChildProfile } from '../domain/types';
import type { BookPage } from '../features/say/page';
import { SESSION } from './pending';
import { SCHEMA_VERSION, type PageRow, type Remote } from './sync';

// The family's account lives in Supabase (project "Wunder Tutor", Singapore): sign-in by a code sent to the grown-up's
// email, and the tables of supabase/migrations behind row level security — a signed-in parent reaches their own rows
// and nothing else. Both values below are public by design (they identify the project; they open nothing).
// This file is loaded only on a device that has, or is getting, an account: see account.ts.
const URL = 'https://xzghsihffoliduqkjvck.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_Ws_jIqScE49tMDdGW2ekUQ_pDIqXD3S';

export const auth = new AuthClient({
  url: `${URL}/auth/v1`,
  headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
  storageKey: SESSION,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true, // the link in the email also signs in, when it is opened in this browser
});

const db = new PostgrestClient(`${URL}/rest/v1`, {
  headers: { apikey: PUBLISHABLE_KEY },
  fetch: async (input, init) => {
    const { data } = await auth.getSession();
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${data.session?.access_token ?? PUBLISHABLE_KEY}`);
    return fetch(input, { ...init, headers });
  },
});

export type { Session };

class RemoteError extends Error {
  constructor(what: string, readonly code?: string) { super(`${what}${code ? ` (${code})` : ''}`); }
}
const must = <T>(what: string, r: { data: T; error: { code?: string; message: string } | null }): T => {
  if (r.error) throw new RemoteError(`${what}: ${r.error.message}`, r.error.code);
  return r.data;
};

const stored = (p: BookPage) => ({ reading: p.reading, best: p.best, at: p.at });

export function remoteFor(user: string): Remote {
  return {
    async learnerHeads() {
      const rows = must('learners', await db.from('learners').select('id, rev, deleted_at'));
      return (rows ?? []).map((r) => ({ id: r.id as string, rev: Number(r.rev), deleted: r.deleted_at != null }));
    },
    async learnerState(id) {
      const row = must('learner', await db.from('learners').select('state, rev').eq('id', id).is('deleted_at', null).maybeSingle());
      return row ? { state: row.state as ChildProfile, rev: Number(row.rev) } : null;
    },
    async insertLearner(id, state) {
      const { error } = await db.from('learners').insert({ parent_id: user, id, state, schema_version: SCHEMA_VERSION });
      if (!error) return 'ok';
      if (error.code === '23505') return 'exists';
      if (error.code === '54000') return 'full';
      throw new RemoteError(`add learner: ${error.message}`, error.code);
    },
    async updateLearner(id, state, fromRev) {
      const { data, error } = await db.from('learners').update({ state, rev: fromRev + 1, schema_version: SCHEMA_VERSION }).eq('id', id).eq('rev', fromRev).select('rev');
      if (error?.code === '55000' || error?.code === '40001') return false;  // deleted, or the revision moved under us
      if (error) throw new RemoteError(`save learner: ${error.message}`, error.code);
      return (data ?? []).length === 1;
    },
    async deleteLearner(id) { must('delete learner', await db.rpc('delete_learner', { p_learner: id })); },
    async pageHeads() {
      const rows = must('pages', await db.from('learner_pages').select('learner_id, id, changed, deleted_at'));
      return (rows ?? []).map((r) => ({ learner: r.learner_id as string, id: r.id as string, changed: Number(r.changed), deleted: r.deleted_at != null }));
    },
    async pages(learner, ids) {
      const rows = must('pages', await db.from('learner_pages').select('id, data, changed').eq('learner_id', learner).in('id', ids).is('deleted_at', null));
      return (rows ?? []).map((r): PageRow => {
        const d = r.data as { reading: BookPage['reading']; best?: BookPage['best']; at?: number };
        return { learner, id: r.id as string, changed: Number(r.changed), page: Array.isArray(d?.reading?.lines) ? { id: r.id as string, reading: d.reading, best: d.best ?? {}, at: d.at ?? Number(r.changed), changed: Number(r.changed) } : null };
      }).filter((r) => r.page);
    },
    async upsertPages(rows) {
      const now = new Date().toISOString();
      must('save pages', await db.from('learner_pages').upsert(
        rows.map((r) => ({ parent_id: user, learner_id: r.learner, id: r.id, changed: r.changed, data: r.page ? stored(r.page) : {}, deleted_at: r.page ? null : now })),
        { onConflict: 'parent_id,learner_id,id' },
      ));
    },
  };
}

/** What the grown-up agreed to when the account was made: kept with its wording, once per version. */
export async function recordConsent(version: string, language: Language, wording: string): Promise<void> {
  const seen = must('consents', await db.from('consents').select('id').eq('consent_type', 'terms_and_privacy').eq('policy_version', version).is('revoked_at', null).limit(1));
  if (!(seen ?? []).length) must('consent', await db.from('consents').insert({ consent_type: 'terms_and_privacy', policy_version: version, language, wording }));
}

export async function deleteAccount(): Promise<void> {
  must('delete account', await db.rpc('delete_my_account'));
  await auth.signOut({ scope: 'local' }).catch(() => undefined);
}
