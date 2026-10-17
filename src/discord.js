// Discord przez REST API (bez stałego połączenia – bot budzi się co kilka minut w GitHub Actions).
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config.js';
import { sleep, log } from './util.js';

const API = 'https://discord.com/api/v10';
const MAX_FILE = 9.5 * 1024 * 1024; // limit wysyłki plików przez bota: 10 MB

async function call(method, route, { json, form } = {}, attempt = 0) {
  const res = await fetch(API + route, {
    method,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json ? JSON.stringify(json) : form,
  });
  if (res.status === 429 && attempt < 5) {
    const body = await res.json().catch(() => ({}));
    await sleep(Math.ceil((body.retry_after ?? 1) * 1000) + 100);
    return call(method, route, { json, form }, attempt + 1);
  }
  if (!res.ok) throw new Error(`Discord ${method} ${route}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const byId = (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1);

// Wiadomości nowsze niż `after` (rosnąco). Bez `after` – ostatnie 50.
export async function readMessages(channelId, after) {
  const out = [];
  let cursor = after;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('after', cursor);
    else q.set('limit', '50');
    const batch = await call('GET', `/channels/${channelId}/messages?${q}`);
    if (!batch.length) break;
    batch.sort(byId);
    out.push(...batch);
    if (!cursor || batch.length < 100) break;
    cursor = batch[batch.length - 1].id;
  }
  return out.sort(byId);
}

export const deleteMessage = (channelId, messageId) => call('DELETE', `/channels/${channelId}/messages/${messageId}`);
export const getMessage =(channelId, messageId) => call('GET', `/channels/${channelId}/messages/${messageId}`);

export async function latestMessageId(channelId) {
  const batch = await call('GET', `/channels/${channelId}/messages?limit=1`);
  return batch[0]?.id ?? null;
}

// Wysyła wiadomość; files: [{ path, name }]. Za duże pliki pomija (zwraca ich listę).
export async function send(channelId, { content = '', files = [], mention } = {}) {
  const ok = files.filter((f) => fs.existsSync(f.path) && fs.statSync(f.path).size <= MAX_FILE);
  const skipped = files.filter((f) => !ok.includes(f));
  const payload = {
    content: content.slice(0, 2000),
    allowed_mentions: { users: mention ? [mention] : [] },
  };
  if (!ok.length) {
    const msg = await call('POST', `/channels/${channelId}/messages`, { json: payload });
    return { msg, skipped };
  }
  const form = new FormData();
  payload.attachments = ok.map((f, i) => ({ id: i, filename: f.name ?? path.basename(f.path) }));
  form.append('payload_json', JSON.stringify(payload));
  ok.forEach((f, i) => form.append(`files[${i}]`, new Blob([fs.readFileSync(f.path)]), f.name ?? path.basename(f.path)));
  const msg = await call('POST', `/channels/${channelId}/messages`, { form });
  return { msg, skipped };
}

export async function react(channelId, messageId, emoji) {
  try {
    await call('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  } catch (e) {
    log('reakcja nieudana', e.message);
  }
}

export async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pobieranie ${url}: ${res.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// --- konfiguracja (scripts/setup.js) ---
export const me = () => call('GET', '/users/@me');
export const myGuilds = () => call('GET', '/users/@me/guilds');
export const guildChannels = (guildId) => call('GET', `/guilds/${guildId}/channels`);
export const createChannel = (guildId, name, topic) => call('POST', `/guilds/${guildId}/channels`, { json: { name, topic, type: 0 } });
export const channelWebhooks = (channelId) => call('GET', `/channels/${channelId}/webhooks`);
export const createWebhook = (channelId, name) => call('POST', `/channels/${channelId}/webhooks`, { json: { name } });
