import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../speech/health', () => ({ apiFetch: (...args: unknown[]) => fixture.request(...args) }));
import { useReminders } from '../notifications/preferences';
import { enableReminders, saveReminders, stopReminders, support } from '../notifications/client';
const prefs = { days:[1,3,5], time:'18:00', quietStart:'20:00', quietEnd:'08:00', timezone:'Asia/Hong_Kong', locale:'en', courses:['en'], weekly:false, pauseUntil:0, skipDay:'' };
let post: ReturnType<typeof vi.fn>, unsubscribe: ReturnType<typeof vi.fn>, subscribe: ReturnType<typeof vi.fn>;
beforeEach(() => {
  post=vi.fn(); unsubscribe=vi.fn().mockResolvedValue(true);
  const sub={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test'}),unsubscribe};
  subscribe=vi.fn().mockResolvedValue(sub);
  const reg={active:{postMessage:post},getNotifications:async()=>[],pushManager:{getSubscription:async()=>null,subscribe}};
  vi.stubGlobal('navigator',{ userAgent:'Edge',platform:'Win32',maxTouchPoints:0,serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg),getRegistration:async()=>reg} });
  vi.stubGlobal('window',{isSecureContext:true,PushManager:{},Notification:{}});
  vi.stubGlobal('Notification',{permission:'granted',requestPermission:vi.fn().mockResolvedValue('granted')});
  vi.stubGlobal('document',{visibilityState:'hidden'});
  fixture.request.mockReset().mockImplementation(async (_url,init) => { const op=JSON.parse(init.body).op; return Response.json(op==='key'?{publicKey:'B'+'A'.repeat(86)}:{enabled:op!=='disable',thisDevice:true,nextAt:null,prefs}); });
  useReminders.setState({enabled:false,offered:false,prefs,followTimezone:false});
});
afterEach(()=>vi.unstubAllGlobals());
describe('gauntlet: notification browser lifecycle',()=>{
  it('saving while off never enables delivery locally or requests permission',async()=>{
    await saveReminders(prefs,false);
    expect(fixture.request).not.toHaveBeenCalled(); expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({disabled:true}));
  });
  it.each(['default','denied'])('permission result %s never subscribes or saves enabled',async result=>{
    vi.stubGlobal('Notification',{permission:'default',requestPermission:vi.fn().mockResolvedValue(result)});
    await expect(enableReminders(prefs,false)).rejects.toThrow('denied');
    expect(subscribe).not.toHaveBeenCalled();expect(useReminders.getState().enabled).toBe(false);
  });
  it('server failure after subscription unsubscribes and leaves reminders off',async()=>{
    fixture.request.mockImplementation(async(_url,init)=>JSON.parse(init.body).op==='key'?Response.json({publicKey:'B'+'A'.repeat(86)}):new Response('',{status:503}));
    await expect(enableReminders(prefs,false)).rejects.toThrow('unavailable');
    expect(unsubscribe).toHaveBeenCalledTimes(1);expect(useReminders.getState().enabled).toBe(false);
  });
  it('opt-out while enable is in flight wins even when the response arrives later',async()=>{
    let resolve!: (r:Response)=>void;
    fixture.request.mockImplementation(async(_url,init)=>JSON.parse(init.body).op==='key'?Response.json({publicKey:'B'+'A'.repeat(86)}):JSON.parse(init.body).op==='enable'?new Promise<Response>(r=>{resolve=r;}):Response.json({enabled:false}));
    const job=enableReminders(prefs,false);
    await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));
    await stopReminders(); resolve(Response.json({enabled:true,thisDevice:true}));
    await job.catch(()=>undefined);
    expect(useReminders.getState().enabled).toBe(false);expect(unsubscribe).toHaveBeenCalled();
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({disabled:true}));
    expect(fixture.request.mock.calls.map(([,init])=>JSON.parse(init.body).op)).toContain('disable');
  });
  it('iOS explains installation before any permission prompt',()=>{
    vi.stubGlobal('navigator',{userAgent:'iPhone',platform:'iPhone',serviceWorker:{}});
    vi.stubGlobal('matchMedia',()=>({matches:false}));
    expect(support()).toBe('install');expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
});
