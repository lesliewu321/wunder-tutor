// wunder-egress — where the app's calls to Google leave Cloudflare.
//
// Google's Gemini service refuses requests that come from Hong Kong, and the app's API (a Pages Function) runs at the
// Cloudflare location nearest the learner: for the launch market, Hong Kong. A Durable Object, unlike a Function,
// lives in ONE place — chosen when it is first used (the caller passes a location hint) — and stays there. The API
// sends every Google request through one of these objects, so the request leaves from wherever the object lives, not
// from wherever the learner is. The API checks that Google accepts that place and moves on to the next object if not
// (functions/api/[[path]].js).
//
// It forwards to Google's Gemini address and nowhere else, stores nothing and logs nothing. The request carries the
// API key (set by the API); this Worker has no address of its own, so only the app's binding can reach it.
import { DurableObject } from 'cloudflare:workers';

const GOOGLE = 'generativelanguage.googleapis.com';

export class GoogleEgress extends DurableObject {
  /** The Cloudflare location this object lives at ("NRT"), for the status page. */
  async where() {
    this.colo ??= await fetch('https://www.cloudflare.com/cdn-cgi/trace').then((r) => r.text()).then((t) => /^colo=(\w+)/m.exec(t)?.[1] ?? '?', () => '?');
    return this.colo;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'egress.internal') {
      // A relay lives where it is first used FROM. "spawn" first-uses another relay from here — a place outside Hong
      // Kong — so an Asia-Pacific relay does not end up in Hong Kong just because a Hong Kong learner was first.
      const name = url.searchParams.get('name'), hint = url.searchParams.get('hint');
      if (url.pathname === '/spawn' && name) {
        const child = this.env.EGRESS.get(this.env.EGRESS.idFromName(name), hint ? { locationHint: hint } : undefined);
        const livesAt = await child.fetch('https://egress.internal/where').then((r) => r.json()).then((j) => j.colo, () => '?');
        return Response.json({ from: await this.where(), name, hint, livesAt });
      }
      return Response.json({ colo: await this.where() });
    }
    if (url.protocol !== 'https:' || url.hostname !== GOOGLE) return new Response('only Google', { status: 403 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return fetch(request);

    // The teacher voice is a WebSocket: open it from here, and hand the caller the other end of a pipe.
    const upstream = (await fetch(request.url, { headers: { Upgrade: 'websocket' } })).webSocket;
    if (!upstream) return new Response('upgrade refused', { status: 502 });
    upstream.binaryType = 'arraybuffer';
    upstream.accept();
    const [client, server] = Object.values(new WebSocketPair());
    server.binaryType = 'arraybuffer';
    server.accept();
    const pipe = (from, to) => {
      from.addEventListener('message', (e) => { try { to.send(e.data); } catch { /* the other end is gone */ } });
      from.addEventListener('close', (e) => { try { to.close(e.code === 1005 || e.code === 1006 ? 1000 : e.code, e.reason); } catch { /* already closed */ } });
      from.addEventListener('error', () => { try { to.close(1011, 'relay error'); } catch { /* already closed */ } });
    };
    pipe(server, upstream);
    pipe(upstream, server);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default { fetch: () => new Response('not found', { status: 404 }) };
