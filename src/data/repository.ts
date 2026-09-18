import { createStore, del, get, keys, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

// Persistence seam. Today everything lives on the device: learner state in localStorage and raw
// audio in IndexedDB — deliberately separate, so recordings can be wiped without touching scores
// (mirrors the `recordings` vs `pronunciation_assessments` split in supabase/schema.sql).
// A Supabase-backed implementation only needs to satisfy these two interfaces.

export interface AudioRepository {
  save(key: string, blob: Blob): Promise<void>;
  load(key: string): Promise<Blob | undefined>;
  remove(keysToRemove: string[]): Promise<void>;
  /** Remove every recording whose key starts with the prefix ('' = all). Returns how many were removed. */
  clear(prefix?: string): Promise<number>;
  count(prefix?: string): Promise<number>;
}

const memory = new Map<string, string>();

/** localStorage with an in-memory fallback (private mode, storage disabled, quota exceeded). */
export const stateStorage: StateStorage = {
  getItem: (name) => { try { return localStorage.getItem(name); } catch { return memory.get(name) ?? null; } },
  setItem: (name, value) => { try { localStorage.setItem(name, value); } catch { memory.set(name, value); } },
  removeItem: (name) => { try { localStorage.removeItem(name); } catch { memory.delete(name); } },
};

class LocalAudioRepository implements AudioRepository {
  private store = typeof indexedDB !== 'undefined' ? createStore('wunder-tutor-audio', 'recordings') : undefined;
  private fallback = new Map<string, Blob>();

  async save(key: string, blob: Blob) {
    try { if (this.store) return await set(key, blob, this.store); } catch { /* fall through to memory */ }
    this.fallback.set(key, blob);
  }
  async load(key: string) {
    try { if (this.store) return (await get<Blob>(key, this.store)) ?? this.fallback.get(key); } catch { /* memory */ }
    return this.fallback.get(key);
  }
  private async allKeys(prefix = ''): Promise<string[]> {
    let ks: string[] = [...this.fallback.keys()];
    try { if (this.store) ks = ks.concat((await keys(this.store)).map(String)); } catch { /* memory only */ }
    return ks.filter((k) => k.startsWith(prefix));
  }
  async remove(ks: string[]) {
    for (const k of ks) {
      this.fallback.delete(k);
      try { if (this.store) await del(k, this.store); } catch { /* ignore */ }
    }
  }
  async clear(prefix = '') {
    const ks = await this.allKeys(prefix);
    await this.remove(ks);
    return ks.length;
  }
  async count(prefix = '') {
    return (await this.allKeys(prefix)).length;
  }
}

export const audioRepo: AudioRepository = new LocalAudioRepository();
