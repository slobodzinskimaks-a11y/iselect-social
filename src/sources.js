// Źródła treści ogólnych: świeże nagłówki z serwisów o Apple (RSS) + zdjęcia/filmy z legalnych, darmowych banków.
// Zdjęć z cudzych profili społecznościowych NIE pobieramy (prawa autorskie) – z social mediów bierzemy tylko tematy i trendy.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './config.js';
import { log } from './util.js';

const FEEDS = [
  ['iMagazine', 'https://imagazine.pl/feed/'],
  ['Google News PL', 'https://news.google.com/rss/search?q=iPhone+OR+Apple+when:7d&hl=pl&gl=PL&ceid=PL:pl'],
  ['Spider’s Web', 'https://www.spidersweb.pl/feed'],
  ['Antyweb', 'https://antyweb.pl/feed'],
  ['MacRumors', 'https://www.macrumors.com/macrumors.xml'],
  ['9to5Mac', 'https://9to5mac.com/feed/'],
];
const UA = { 'User-Agent': 'Mozilla/5.0 (iselect-social-bot)' };

const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, '’').replace(/&#8211;/g, '–')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// Nagłówki z ostatnich `days` dni, tylko o Apple/iPhone/telefonach.
export async function recentHeadlines(days = 8, perFeed = 12) {
  const since = Date.now() - days * 86400000;
  const out = [];
  await Promise.all(FEEDS.map(async ([source, url]) => {
    try {
      const xml = await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) })).text();
      const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map((m) => m[0]);
      let n = 0;
      for (const it of items) {
        const title = decode(it.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '');
        const date = new Date(decode(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '')).getTime();
        if (!title || (date && date < since)) continue;
        if (!/iphone|apple|ios|smartfon|telefon|samsung|android|pixel/i.test(title)) continue;
        const desc = decode(it.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? '').slice(0, 280);
        out.push({ source, title, date: date ? new Date(date).toISOString().slice(0, 10) : '', desc: desc.startsWith(title.slice(0, 20)) ? '' : desc });
        if (++n >= perFeed) break;
      }
    } catch (e) {
      log('RSS', source, e.message);
    }
  }));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- zdjęcia i filmy ----------
async function download(url, file) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function savePhoto(buf, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(buf).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
  return file;
}

async function pexelsPhotos(query, n) {
  if (!env.PEXELS_API_KEY) return [];
  const res = await fetch(`https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(n + 2), size: 'large' })}`, { headers: { Authorization: env.PEXELS_API_KEY } });
  const data = await res.json();
  return (data.photos ?? []).slice(0, n).map((p) => ({ url: p.src.large2x ?? p.src.large, credit: `${p.photographer} / Pexels`, source: 'pexels' }));
}

// Pixabay: darmowa licencja, użycie komercyjne bez podpisu.
async function pixabayPhotos(query, n) {
  if (!env.PIXABAY_API_KEY) return [];
  const res = await fetch(`https://pixabay.com/api/?${new URLSearchParams({ key: env.PIXABAY_API_KEY, q: query, image_type: 'photo', per_page: String(Math.max(3, n + 2)), safesearch: 'true', min_width: '1080' })}`);
  const data = await res.json();
  return (data.hits ?? []).slice(0, n).map((h) => ({ url: h.largeImageURL, credit: `${h.user} / Pixabay`, source: 'pixabay' }));
}

// Openverse (bez klucza): tylko licencje CC0 i domena publiczna – bez obowiązku podpisu.
async function openversePhotos(query, n) {
  const res = await fetch(`https://api.openverse.org/v1/images/?${new URLSearchParams({ q: query, license: 'cc0,pdm', page_size: String(n + 3), mature: 'false' })}`, { headers: UA });
  const data = await res.json().catch(() => ({}));
  return (data.results ?? []).filter((r) => (r.width ?? 0) >= 900).slice(0, n).map((r) => ({ url: r.url, credit: `${r.creator ?? 'autor nieznany'} / ${r.source} (${r.license})`, source: 'openverse' }));
}

// Kandydaci na zdjęcie do jednego zapytania (Pexels → Openverse), zapisani lokalnie.
export async function photoCandidates(query, dir, n = 3) {
  let found = [];
  try { found = await pexelsPhotos(query, n); } catch (e) { log('Pexels', e.message); }
  if (found.length < n) {
    try { found.push(...await pixabayPhotos(query, n - found.length)); } catch (e) { log('Pixabay', e.message); }
  }
  if (found.length < n) {
    try { found.push(...await openversePhotos(query, n - found.length)); } catch (e) { log('Openverse', e.message); }
  }
  const out = [];
  for (const [i, f] of found.entries()) {
    try {
      const file = path.join(dir, `${query.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}-${i}.jpg`);
      out.push({ ...f, query, file: await savePhoto(await download(f.url, file), file) });
    } catch (e) {
      log('Zdjęcie', f.url, e.message);
    }
  }
  return out;
}

async function pixabayVideo(query, dir) {
  const res = await fetch(`https://pixabay.com/api/videos/?${new URLSearchParams({ key: env.PIXABAY_API_KEY, q: query, per_page: '10', safesearch: 'true' })}`);
  const data = await res.json();
  for (const v of data.hits ?? []) {
    if (v.duration < 3 || v.duration > 40) continue;
    const f = v.videos?.large?.url ? v.videos.large : v.videos?.medium;
    if (!f?.url || f.size > 40 * 1024 * 1024) continue;
    const file = path.join(dir, `v-${query.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}.mp4`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, await download(f.url, file));
    const thumb = f.thumbnail ? await savePhoto(await download(f.thumbnail, file), file.replace(/\.mp4$/, '.jpg')) : null;
    return { file, thumb, query, credit: `${v.user} / Pixabay` };
  }
  return null;
}

// Klip do rolki (Pexels → Pixabay). Kadr kadrujemy do pionu w szablonie.
export async function videoCandidate(query, dir) {
  if (!env.PEXELS_API_KEY) {
    if (!env.PIXABAY_API_KEY) return null;
    try { return await pixabayVideo(query, dir); } catch (e) { log('Pixabay video', query, e.message); return null; }
  }
  try {
    const res = await fetch(`https://api.pexels.com/videos/search?${new URLSearchParams({ query, orientation: 'portrait', size: 'medium', per_page: '8' })}`, { headers: { Authorization: env.PEXELS_API_KEY } });
    const data = await res.json();
    for (const v of data.videos ?? []) {
      if (v.duration < 3 || v.duration > 40) continue;
      const f = v.video_files.filter((x) => x.file_type === 'video/mp4' && x.height >= 1280 && x.height <= 2400).sort((a, b) => a.height - b.height)[0];
      if (!f) continue;
      const file = path.join(dir, `v-${query.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}.mp4`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, await download(f.link, file));
      const thumb = await savePhoto(await download(v.image, file), file.replace(/\.mp4$/, '.jpg'));
      return { file, thumb, query, credit: `${v.user?.name ?? ''} / Pexels` };
    }
  } catch (e) {
    log('Pexels video', query, e.message);
  }
  return null;
}
