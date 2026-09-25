import { describe, expect, it, vi } from 'vitest';
import { ReminderService, subscription, sendPush } from '../../notifications/service.mjs';
import webpush from 'web-push';
import { createECDH } from 'node:crypto';
import ece from 'http_ece';
import { createApi } from '../../server/core.mjs';
const now = Date.parse('2026-09-25T09:00:00Z');
const device = '00000000-1111-4111-8111-000000000001', second = '00000000-1111-4111-8111-000000000002';
const prefs = { days: [1,3,5], time: '18:00', quietStart: '20:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', locale: 'en', courses: ['en'], weekly: false, pauseUntil: 0, skipDay: '' };
const browserKey = createECDH('prime256v1'); browserKey.generateKeys();
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: browserKey.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } };
function setup() {
  let saved = null, time = now, alarmAt = null;
  const store = { read: () => structuredClone(saved), write: s => { saved = structuredClone(s); }, clear: () => { saved = null; }, setAlarm: async at => { alarmAt = at; }, deleteAlarm: async () => { alarmAt = null; } };
  const send = vi.fn().mockResolvedValue(201);
  const service = new ReminderService(store, { now: () => time, send });
  return { service, send, store, time: v => { time = v; }, alarm: () => alarmAt };
}
async function enable(s, over = {}) {
  await s.service.request({ op: 'key', device });
  return s.service.request({ op: 'enable', device, prefs, subscription: sub, ...over });
}
describe('durable reminder delivery', () => {
  it('keeps signing secrets private and one primary device', async () => {
    const s = setup(); const result = await enable(s);
    expect(result.enabled).toBe(true); expect(JSON.stringify(result)).not.toContain('privateKey');
    await s.service.request({ op: 'enable', device: second, prefs, subscription: sub });
    expect((await s.service.request({ op: 'status', device })).thisDevice).toBe(false);
    await s.service.request({ op: 'disable', device });
    expect((await s.service.request({ op: 'status', device: second })).enabled).toBe(true);
  });
  it('sends once even if an alarm is retried', async () => {
    const s = setup(); await enable(s); s.time(now + 3600000);
    await s.service.alarm(); await s.service.alarm();
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send.mock.calls[0][2]).toMatchObject({ title: 'Wunder Tutor', kind: 'practice' });
  });
  it('retains daily cap across opt-out and re-enable', async () => {
    const s = setup(); await enable(s); s.time(now + 3600000); await s.service.alarm();
    await s.service.request({ op: 'disable', device });
    await enable(s, { prefs: { ...prefs, time: '19:00' } }); s.time(now + 7200000); await s.service.alarm();
    expect(s.send).toHaveBeenCalledTimes(1);
  });
  it('merges completion from another signed-in device without replacing the primary', async () => {
    const s = setup(); await enable(s);
    await s.service.request({ op: 'heartbeat', device: second, practicedDays: ['2026-09-25'] });
    s.time(now + 3600000); await s.service.alarm();
    expect(s.send).not.toHaveBeenCalled();
    expect(s.store.read().device).toBe(device);
  });
  it('cleans expired subscriptions and never retries ambiguous sends', async () => {
    const s = setup(); await enable(s); s.send.mockResolvedValueOnce(410); s.time(now + 3600000); await s.service.alarm();
    expect(s.store.read().subscription).toBe(null);
    const other = setup(); await enable(other); other.send.mockRejectedValueOnce(new Error('timeout')); other.time(now + 3600000);
    await other.service.alarm(); await other.service.alarm(); expect(other.send).toHaveBeenCalledTimes(1);
  });
  it('cleans abandoned registrations and keys', async () => {
    const s = setup(); await enable(s); s.time(now + 31 * 86400000); await s.service.alarm();
    expect(s.store.read()).toBe(null); expect(s.alarm()).toBe(null);
  });
  it('does not undo an opt-out during an in-flight send', async () => {
    const s = setup(); await enable(s); s.time(now + 3600000);
    s.send.mockImplementationOnce(async () => { await s.service.request({ op: 'disable', device }); return 410; });
    await s.service.alarm(); expect(s.store.read().subscription).toBeUndefined();
  });
  it('rejects arbitrary endpoints, redirect targets and malformed keys', () => {
    for (const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://example.com/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x']) expect(() => subscription({ ...sub, endpoint })).toThrow();
    expect(() => subscription({ ...sub, keys: { auth: 'bad', p256dh: 'bad' } })).toThrow();
    expect(subscription(sub)).toEqual(sub);
  });
  it('produces decryptable Web Push payloads with short TTL and no redirects', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      expect(init.redirect).toBe('error'); expect(String(init.headers.TTL)).toBe('300');
      const message = ece.decrypt(init.body, { version: 'aes128gcm', privateKey: browserKey, authSecret: Buffer.alloc(16, 1) });
      expect(JSON.parse(message.toString())).toEqual({ body: 'A little practice' });
      return new Response(null, { status: 201 });
    });
    expect(await sendPush(sub, webpush.generateVAPIDKeys(), { body: 'A little practice' }, fetcher)).toBe(201);
  });
});
describe('notification API access', () => {
  it('requires access and never trusts a user id from the client', async () => {
    const reminders = vi.fn().mockResolvedValue({ enabled: false });
    const api = createApi({ BETA_ACCESS_CODE: 'test-code' }, { requireAccessCode: true, reminders });
    const body = JSON.stringify({ op: 'status', device, userId: 'someone-else' });
    expect((await api.handle(new Request('https://app.wundertutor.com/api/notifications', { method: 'POST', body }))).status).toBe(401);
    expect(reminders).not.toHaveBeenCalled();
    expect((await api.handle(new Request('https://app.wundertutor.com/api/notifications', { method: 'POST', body, headers: { 'x-wunder-access': 'test-code' } }))).status).toBe(200);
    expect(reminders.mock.calls[0][0]).toBe('device/' + device);
  });
});
