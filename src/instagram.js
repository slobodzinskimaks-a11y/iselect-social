// Oficjalne, darmowe Instagram API (logowanie przez Instagram – bez strony na Facebooku).
// Publikuje karuzele i relacje. Rolki z muzyką z biblioteki IG publikujesz z telefonu (API tego nie umie).
import { config, env } from './config.js';
import { log, sleep } from './util.js';

const base = () => `https://graph.instagram.com/${config.IG_API_VERSION}`;

async function call(method, route, params = {}) {
  const q = new URLSearchParams({ ...params, access_token: env.IG_ACCESS_TOKEN });
  const url = `${base()}${route}`;
  const res = await fetch(method === 'GET' ? `${url}?${q}` : url, {
    method,
    ...(method === 'GET' ? {} : { body: q }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(`Instagram ${route}: ${data.error?.message ?? res.status}`);
    err.ig = data.error;
    throw err;
  }
  return data;
}

const userId = () => env.IG_USER_ID || 'me';

async function waitReady(containerId) {
  for (let i = 0; i < 30; i++) {
    const { status_code: status } = await call('GET', `/${containerId}`, { fields: 'status_code' });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Kontener ${containerId}: ${status}`);
    await sleep(5000);
  }
  throw new Error(`Kontener ${containerId}: przekroczony czas przetwarzania`);
}

async function publishContainer(id) {
  await waitReady(id);
  const { id: mediaId } = await call('POST', `/${userId()}/media_publish`, { creation_id: id });
  const { permalink } = await call('GET', `/${mediaId}`, { fields: 'permalink' }).catch(() => ({}));
  return { mediaId, permalink };
}

async function carouselContainer(imageUrls, caption, collaborators) {
  const children = [];
  for (const url of imageUrls) {
    const { id } = await call('POST', `/${userId()}/media`, { image_url: url, is_carousel_item: 'true' });
    children.push(id);
  }
  for (const id of children) await waitReady(id);
  const params = { media_type: 'CAROUSEL', children: children.join(','), caption };
  if (collaborators.length) params.collaborators = JSON.stringify(collaborators);
  return (await call('POST', `/${userId()}/media`, params)).id;
}

// Karuzela jako współtworzona. Jeśli Instagram odrzuci któregoś współtwórcę,
// publikujemy bez niego i zwracamy listę pominiętych (bot o tym poinformuje).
export async function publishCarousel(imageUrls, caption, collaborators = config.COLLABORATORS) {
  let collabs = [...collaborators];
  const dropped = [];
  for (;;) {
    try {
      const id = await carouselContainer(imageUrls, caption, collabs);
      return { ...(await publishContainer(id)), collaborators: collabs, dropped };
    } catch (e) {
      const msg = `${e.message} ${JSON.stringify(e.ig ?? {})}`.toLowerCase();
      const bad = collabs.find((c) => msg.includes(c.toLowerCase()));
      if (collabs.length && (bad || /collaborat/.test(msg))) {
        const drop = bad ?? collabs[collabs.length - 1];
        log(`Współtwórca odrzucony (${drop}), ponawiam bez niego`);
        dropped.push(drop);
        collabs = collabs.filter((c) => c !== drop);
        continue;
      }
      throw e;
    }
  }
}

export async function publishStory(imageUrl) {
  const { id } = await call('POST', `/${userId()}/media`, { image_url: imageUrl, media_type: 'STORIES' });
  return publishContainer(id);
}

export async function profile() {
  return call('GET', '/me', { fields: 'user_id,username,account_type,followers_count,media_count' });
}

// Token długoterminowy ważny 60 dni – odświeżamy co ~3 tygodnie.
export async function refreshToken() {
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN)}`);
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Odświeżenie tokena: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

// Statystyki ostatnich publikacji – bot uczy się z nich, które hooki działają.
export async function recentPerformance(days = 21) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const { data = [] } = await call('GET', `/${userId()}/media`, {
    fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count', limit: '30', since: String(since),
  });
  const out = [];
  for (const m of data) {
    const metrics = m.media_product_type === 'REELS'
      ? 'reach,views,saved,shares,total_interactions,ig_reels_avg_watch_time'
      : 'reach,views,saved,shares,total_interactions';
    let ins = {};
    try {
      const r = await call('GET', `/${m.id}/insights`, { metric: metrics });
      ins = Object.fromEntries(r.data.map((x) => [x.name, x.values?.[0]?.value ?? x.total_value?.value ?? 0]));
    } catch (e) {
      log('insights', m.id, e.message);
    }
    out.push({
      type: m.media_product_type === 'REELS' ? 'rolka' : m.media_type === 'CAROUSEL_ALBUM' ? 'karuzela' : 'post',
      date: m.timestamp?.slice(0, 10),
      hook: (m.caption ?? '').split('\n')[0].slice(0, 140),
      permalink: m.permalink,
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      reach: ins.reach ?? 0,
      views: ins.views ?? 0,
      saves: ins.saved ?? 0,
      shares: ins.shares ?? 0,
      watch_s: ins.ig_reels_avg_watch_time ? Math.round(ins.ig_reels_avg_watch_time / 100) / 10 : undefined,
    });
  }
  return out;
}
