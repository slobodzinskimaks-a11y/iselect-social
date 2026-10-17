// Test całego tygodnia na prawdziwym kodzie: Discord, Gemini i Instagram są podstawione (fałszywy fetch), render jest prawdziwy.
// Niedziela: prośba → zgłoszenie ze zdjęciami → materiały → akceptacja na stronie → pon. 21:00 rolka na Discord
// → śr. 21:00 karuzela na IG jako współtworzona → czw. „sprzedany” → relacja SPRZEDANE + treści ogólne.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iselect-week-'));
Object.assign(process.env, {
  DATA_DIR, DISCORD_BOT_TOKEN: 'bot', GEMINI_API_KEY: 'gem', IG_ACCESS_TOKEN: 'igtok', IG_USER_ID: '178',
  REVIEW_WEBHOOK_URL: 'https://discord.com/api/webhooks/999/secret', SITE_URL: 'https://example.test/iselect/',
});
const { config } = await import('../src/config.js');
config.CHANNEL_IDS = { intake: '10', publish: '20', log: '30' };
const { emptyState, loadState, saveState } = await import('../src/state.js');
const { tick } = await import('../src/tick.js');
const { rawPackage } = await import('./fixtures.js');

const PHOTO = fs.readFileSync(new URL('../demo/phone1.jpg', import.meta.url));
const messages = { 10: [], 30: [] };
const sent = [];
const igCalls = [];
let seq = 1000;
const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const body = typeof opts.body === 'string' ? opts.body : opts.body instanceof URLSearchParams ? opts.body.toString() : '';
  if (u.host === 'files.test') return new Response(PHOTO);
  if (u.host === 'discord.com') {
    const m = u.pathname.match(/channels\/(\d+)\/messages(?:\/(\d+)\/reactions)?/);
    if (m?.[2]) return new Response(null, { status: 204 });
    const single = u.pathname.match(/channels\/(\d+)\/messages\/(\d+)$/);
    if (single) return json(messages[single[1]].find((x) => x.id === single[2]));
    if (m && (opts.method ?? 'GET') === 'GET') {
      const after = u.searchParams.get('after');
      return json((messages[m[1]] ?? []).filter((x) => !after || BigInt(x.id) > BigInt(after)).reverse());
    }
    if (m) { sent.push({ channel: m[1], body }); return json({ id: String(seq++) }); }
  }
  if (u.host === 'generativelanguage.googleapis.com') {
    const req = JSON.parse(body);
    const prompt = req.contents[0].parts.map((p) => p.text ?? '').join('\n');
    let text;
    if (req.tools) text = 'Ceny używanych iPhone’ów stabilne; nowy iOS; uwaga na fałszywe linki do płatności.';
    else if (/Wyciągasz dane/.test(req.systemInstruction?.parts[0].text ?? '')) {
      text = JSON.stringify({ model: 'iPhone 13 Pro', storage: '128 GB', color: 'Graphite', battery: '100%', condition: 'pęknięta szybka w rogu', defects: ['pęknięta szybka'], kit: ['pudełko'], price: 1100, extras: '' });
    } else if (prompt.includes('OBECNA WERSJA:')) {
      const spec = JSON.parse(prompt.split('OBECNA WERSJA:')[1].split(/\n\n(?:Zdjęcia|Brak zdjęć)/)[0]);
      spec.scenes[0].title = 'Nowy, mocniejszy hook';
      text = JSON.stringify({ spec });
    } else {
      const slots = [...prompt.matchAll(/- (\d{4}-\d{2}-\d{2}_[a-z_]+):/g)].map((x) => ({ id: x[1], date: x[1].slice(0, 10), kind: x[1].slice(11) }));
      text = JSON.stringify(rawPackage(slots));
    }
    return json({ candidates: [{ content: { parts: [{ text }] } }] });
  }
  if (u.host === 'graph.instagram.com') {
    igCalls.push({ path: u.pathname, params: Object.fromEntries(new URLSearchParams(body || u.search)) });
    if (u.pathname.endsWith('/media')) return json({ id: `c${seq++}` });
    if (u.pathname.endsWith('/media_publish')) return json({ id: `m${seq++}` });
    if (u.pathname.includes('refresh_access_token')) return json({ access_token: 'igtok2', expires_in: 5184000 });
    if (u.searchParams.get('fields') === 'status_code') return json({ status_code: 'FINISHED' });
    if (u.searchParams.get('fields') === 'permalink') return json({ permalink: 'https://www.instagram.com/p/TEST/' });
    return json({ data: [] });
  }
  throw new Error(`Nieoczekiwane zapytanie: ${url}`);
};

// Warszawa = UTC+2 do 25.10, potem UTC+1
const at = (iso) => new Date(iso);
function takeOutbox() {
  const s = loadState();
  const out = s.outbox;
  s.outbox = [];
  saveState(s);
  return out;
}

test('pełny tydzień bota', { timeout: 15 * 60 * 1000 }, async () => {
  const s0 = emptyState();
  s0.cursors = { intake: '100', log: '300' };
  s0.ig.tokenRefreshedAt = new Date().toISOString();
  saveState(s0);

  // Niedziela 18.10, 10:05 – prośba o telefon
  await tick(at('2026-10-18T08:05:00Z'));
  let out = takeOutbox();
  assert.ok(out.some((m) => m.content.includes('jaki telefon promujemy')), 'prośba o telefon');

  // Właściciel wysyła dane + 3 zdjęcia (10 min temu)
  const ts = new Date(Date.now() - 10 * 60000).toISOString();
  // 12 zdjęć w dwóch wiadomościach (Discord: max 10 na wiadomość), potem „gotowe”
  const photos = (from, n) => Array.from({ length: n }, (_, i) => ({ url: `https://files.test/p${from + i}.jpg`, filename: `IMG_${from + i}.jpg`, content_type: 'image/jpeg' }));
  messages[10].push({ id: '101', author: { id: '555', bot: false }, timestamp: ts, content: 'Model: iPhone 13 Pro\nCena: 1100\nBateria: 100%\nStan: pęknięta szybka', attachments: photos(0, 10) });
  messages[10].push({ id: '102', author: { id: '555', bot: false }, timestamp: ts, content: '', attachments: photos(10, 2) });
  let state = await tick(at('2026-10-18T08:12:00Z'));
  assert.equal(Object.keys(state.items).length, 0, 'bez „gotowe” bot czeka na resztę zdjęć');
  assert.equal(state.buffer.messages.length, 2);
  takeOutbox();
  messages[10].push({ id: '103', author: { id: '555', bot: false }, timestamp: new Date().toISOString(), content: 'gotowe', attachments: [] });
  state = await tick(at('2026-10-18T08:20:00Z'));
  out = takeOutbox();
  assert.equal(Object.values(state.phones)[0].photos.length, 12, 'wszystkie 12 zdjęć zapisane');
  assert.equal(state.ownerId, '555');
  const items = Object.values(state.items);
  assert.equal(items.length, 7, 'pakiet na 7 dni');
  assert.ok(items.every((it) => it.status === 'review' && it.media));
  const draftId = Object.keys(state.drafts)[0];
  const link = out.find((m) => m.content.includes('do akceptacji'))?.content ?? '';
  assert.ok(link.includes(`https://example.test/iselect/?d=${draftId}#k=999/secret`), 'link do strony akceptacji z kluczem w #');
  assert.ok(fs.existsSync(path.join(DATA_DIR, 'site', 'drafts', `${draftId}.json`)));

  // Strona akceptacji: akceptuj wszystko, a karuzelę ofertową z poprawionym opisem; rolkę 2 do poprawki
  const offer = items.find((it) => it.kind === 'carousel_offer');
  const angle = items.find((it) => it.kind === 'reel_angle');
  const decisions = items.filter((it) => it !== angle).map((it) => ({ item: it.id, version: 1, action: 'approve', ...(it === offer ? { caption: 'NOWY OPIS' } : {}) }));
  decisions.push({ item: angle.id, version: 1, action: 'revise', notes: 'mocniejszy hook' });
  messages[30].push({ id: '301', webhook_id: '999', author: { id: '999', bot: true }, content: '', embeds: [{ description: `\`\`\`json\n${JSON.stringify({ draft: draftId, decisions })}\n\`\`\`` }] });
  messages[30].push({ id: '302', webhook_id: '777', author: { id: '777', bot: true }, content: '', embeds: [{ description: `\`\`\`json\n${JSON.stringify({ decisions: [{ item: angle.id, version: 1, action: 'approve' }] })}\n\`\`\`` }] });
  state = await tick(at('2026-10-18T09:00:00Z'));
  takeOutbox();
  assert.equal(state.items[offer.id].status, 'approved');
  assert.equal(state.items[offer.id].caption, 'NOWY OPIS');
  assert.equal(state.items[angle.id].status, 'review', 'poprawka wyrenderowana, czeka na akceptację');
  assert.equal(state.items[angle.id].version, 2, 'obcy webhook zignorowany, nowa wersja');

  // Poniedziałek 21:05 – rolka trafia na Discord (z plikiem i opisem osobno), bez API
  state = await tick(at('2026-10-19T19:05:00Z'));
  out = takeOutbox();
  const hook = items.find((it) => it.kind === 'reel_hook');
  assert.equal(state.items[hook.id].status, 'sent');
  assert.ok(out.some((m) => m.channel === 'publish' && m.content.includes('Trendujące') && m.files?.some((f) => f.name === 'rolka.mp4')));
  assert.ok(out.some((m) => m.channel === 'publish' && m.content === state.items[hook.id].caption));
  assert.ok(igCalls.some((c) => c.path.includes('/insights') || c.path.endsWith('/media')), 'niedzielny raport czyta statystyki');
  assert.equal(igCalls.filter((c) => c.path.endsWith('/media_publish')).length, 0, 'rolki nie idą przez API');

  // Środa 21:05 – karuzela na IG z współtwórcami
  state = await tick(at('2026-10-21T19:05:00Z'));
  takeOutbox();
  assert.equal(state.items[offer.id].status, 'published');
  const container = igCalls.find((c) => c.params.media_type === 'CAROUSEL');
  assert.deepEqual(JSON.parse(container.params.collaborators), ['szymon_igg', 'majster_wihajsters']);
  assert.equal(container.params.caption, 'NOWY OPIS');
  assert.ok(igCalls.filter((c) => c.params.is_carousel_item === 'true').every((c) => c.params.image_url.startsWith('https://example.test/iselect/media/')));

  // Czwartek 12:00 – „sprzedany”
  messages[10].push({ id: '104', author: { id: '555', bot: false }, timestamp: new Date().toISOString(), content: 'sprzedany', attachments: [] });
  state = await tick(at('2026-10-22T10:00:00Z'));
  out = takeOutbox();
  const all = Object.values(state.items);
  assert.ok(all.some((it) => it.kind === 'story_sold' && it.status === 'review'));
  assert.equal(state.items[angle.id].status, 'cancelled', 'piątkowa rolka o sprzedanym telefonie wstrzymana');
  assert.equal(all.filter((it) => it.mode === 'general').length, 3, 'pt–nd: treści ogólne');
  assert.ok(out.some((m) => m.content.includes('Gratulacje')));
});
