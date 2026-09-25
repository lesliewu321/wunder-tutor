import { DurableObject } from 'cloudflare:workers';
import { ReminderService } from './service.mjs';

export class ReminderRecipient extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS reminder (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)');
    this.service = new ReminderService({
      read: () => { const row = sql.exec('SELECT value FROM reminder WHERE id=1').toArray()[0]; return row ? JSON.parse(row.value) : null; },
      write: value => sql.exec('INSERT INTO reminder(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value', JSON.stringify(value)),
      clear: () => sql.exec('DELETE FROM reminder'),
      setAlarm: at => ctx.storage.setAlarm(at), deleteAlarm: () => ctx.storage.deleteAlarm(),
    });
  }
  async request(input) { return this.service.request(input); }
  async alarm() { return this.service.alarm(); }
}
// Reachable only through the authenticated Pages binding; no public address or administrative endpoint.
export default { fetch() { return new Response('Not found', { status: 404 }); } };
