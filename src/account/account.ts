import type { Language } from '../i18n';
import { useSyncExternalStore } from 'react';
import { loadShelf, onBookChange, replacePages } from '../features/say/page';
import { useStore } from '../state/store';
import { emailReturnUrl } from '../platform';
import { forgetSync, hasAccountHere, loadMeta, saveMeta } from './pending';
import { syncAccount, type Local } from './sync';

// The learner's own account, as the rest of the app sees it: who is signed in, whether everything is saved, and the
// few things that can be done (send a code, sign in with it, sign out, delete the account). One learner per account
// (Leslie, 2026-09-22). The libraries behind it are loaded only on a device that has an account or is getting one.

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'failed';
export interface Account {
  /** 'unknown' until a device with a stored sign-in has looked at it. */
  status: 'unknown' | 'signed-out' | 'signed-in';
  email: string | null;
  sync: SyncState;
  savedAt: number | null;
  /** The account would not take this device’s learner (it holds one, and it already has another). */
  full: boolean;
}

let state: Account = { status: hasAccountHere() ? 'unknown' : 'signed-out', email: null, sync: 'idle', savedAt: null, full: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<Account>) => { state = { ...state, ...patch }; listeners.forEach((f) => f()); };
export const useAccount = (): Account => useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => state);

type Backend = typeof import('./supabase');
let backend: Promise<Backend> | null = null;
const load = (): Promise<Backend> => (backend ??= import('./supabase').then((b) => {
  b.auth.onAuthStateChange((_event, session) => {
    set(session ? { status: 'signed-in', email: session.user.email ?? null } : { status: 'signed-out', email: null, sync: 'idle', full: false });
    if (session) queueSync(0);
  });
  return b;
}));

// ---------- This device, as the sync engine sees it ----------
let deletedAtRead: string[] = [];
const local: Local = {
  profiles: () => useStore.getState().profiles,
  putProfile: (p) => useStore.setState((s) => ({ profiles: { ...s.profiles, [p.id]: p }, activeId: s.activeId ?? p.id })),
  removeLearner: (id) => useStore.getState().deleteProfile(id, { heardFromAccount: true }),
  shelf: (learner) => { const s = loadShelf(learner); return { pages: s.pages, gone: s.gone ?? {} }; },
  putShelf: (learner, pages, gone) => replacePages(learner, pages, gone),
  meta: () => { const m = loadMeta(); deletedAtRead = m.deleted; return m; },
  putMeta: (m) => saveMeta(m, deletedAtRead.filter((id) => !m.deleted.includes(id))),
};

// ---------- Syncing: soon after a change, when the app comes back, when the network does ----------
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;

function queueSync(delay = 4000): void {
  if (state.status !== 'signed-in') return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      const b = await load();
      const { data } = await b.auth.getSession();
      if (!data.session) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return set({ sync: 'offline' });
      set({ sync: 'saving' });
      const user = data.session.user.id;
      // The account's learner: this device's own, or, if the account already has one, that one (it takes over here).
      const { result } = await syncAccount(user, local, b.remoteFor(user), useStore.getState().activeId,
        (theirs) => useStore.setState((st) => ({ profiles: { ...st.profiles, [theirs.id]: theirs }, activeId: theirs.id })));
      set({ sync: 'saved', savedAt: Date.now(), full: !!result?.full });
    } catch (e) {
      console.warn('[account] sync', e);
      set({ sync: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed' });
    } finally {
      running = null;
      if (again) { again = false; queueSync(1500); }
    }
  })();
  return running;
}

let started = false;
/** Called once when the app starts. Does nothing on a device that has never had an account. */
export function startAccount(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // Our own writes during a sync come back through these listeners: the engine finds nothing new and stops.
  useStore.subscribe((s, prev) => { if (s.profiles !== prev.profiles) queueSync(); });
  onBookChange(() => queueSync());
  window.addEventListener('online', () => queueSync(500));
  document.addEventListener('visibilitychange', () => queueSync(document.visibilityState === 'visible' ? 500 : 0));
  setInterval(() => { if (document.visibilityState === 'visible') queueSync(0); }, 5 * 60_000);
  const arriving = /[#&?](access_token|token_hash|code|error_description)=/.test(window.location.href);
  if (hasAccountHere() || arriving) void load().then((b) => b.auth.getSession()).then(({ data }) => { if (!data.session) set({ status: 'signed-out' }); });
}

// ---------- What can be done ----------
/** unknown: signing in (not making an account), and there is no account with that email. */
export type AccountError = 'email' | 'code' | 'wait' | 'offline' | 'unknown' | 'failed';
const problem = (e: unknown): AccountError => {
  const err = e as { code?: string; status?: number; message?: string } | null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (err?.status === 429 || err?.code === 'over_email_send_rate_limit' || err?.code === 'over_request_rate_limit') return 'wait';
  if (err?.code === 'otp_expired' || err?.code === 'invalid_credentials' || /token/i.test(err?.message ?? '')) return 'code';
  if (err?.code === 'email_address_invalid' || err?.code === 'validation_failed') return 'email';
  if (err?.code === 'otp_disabled' || err?.code === 'signup_disabled' || err?.code === 'user_not_found' || /signups? not allowed/i.test(err?.message ?? '')) return 'unknown';
  return 'failed';
};

/**
 * Sends the email with the code (and a link that does the same). `create`: the learner on this device gets an account
 * (Settings, with consent). Without it, only an account that already exists (the sign-in screen).
 */
export async function sendCode(email: string, create = true): Promise<AccountError | null> {
  try {
    const b = await load();
    const { error } = await b.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: create, emailRedirectTo: emailReturnUrl() } });
    return error ? problem(error) : null;
  } catch (e) { return problem(e); }
}

/** `consent`: what was agreed to when the account is made. Signing in to an account that exists agrees to nothing new. */
export async function signInWithCode(email: string, code: string, consent: { version: string; language: Language; wording: string } | null): Promise<AccountError | null> {
  try {
    const b = await load();
    const { data, error } = await b.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' });
    if (error || !data.session) return problem(error ?? { code: 'otp_expired' });
    if (consent) await b.recordConsent(consent.version, consent.language, consent.wording).catch((e) => console.warn('[account] consent', e));
    return null;
  } catch (e) { return problem(e); }
}

/** The learner stays on this device; nothing more is saved to the account until someone signs in again. */
export async function signOut(): Promise<void> {
  const b = await load();
  await syncNow().catch(() => undefined);
  await import('../notifications/client').then(m => m.stopReminders()).catch(() => undefined);
  await b.auth.signOut({ scope: 'local' });
}

/**
 * Setup with an email whose account already has a learner, and the grown-up chose to start over: the account's
 * learner(s) are erased (tombstoned, as the app's own delete does), so the one just made takes the place.
 */
export async function eraseAccountLearners(): Promise<AccountError | null> {
  try {
    const b = await load();
    const { data } = await b.auth.getSession();
    if (!data.session) return 'failed';
    const remote = b.remoteFor(data.session.user.id);
    for (const h of await remote.learnerHeads()) if (!h.deleted) await remote.deleteLearner(h.id);
    return null;
  } catch (e) { return problem(e); }
}

/** Erases the account with everything in it. Needs the network: it must not be left half done. */
export async function deleteAccount(): Promise<AccountError | null> {
  try {
    const b = await load();
    await import('../notifications/client').then(m => m.stopReminders(true));
    await b.deleteAccount();
    forgetSync();
    return null;
  } catch (e) { return problem(e); }
}
