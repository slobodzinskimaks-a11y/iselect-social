// Wysyła kolejkę wiadomości na Discord. Uruchamiany PO wdrożeniu strony, żeby linki i pliki już działały.
import { config, env } from './config.js';
import * as discord from './discord.js';
import { toAbs } from './site.js';
import { loadState, saveState } from './state.js';
import { log } from './util.js';

function chunks(text, n = 1900) {
  const out = [];
  let rest = text;
  while (rest.length > n) {
    const cut = rest.lastIndexOf('\n', n) > n / 2 ? rest.lastIndexOf('\n', n) : n;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest);
  return out;
}

export async function flush() {
  const state = loadState();
  const queue = state.outbox;
  state.outbox = [];
  for (let i = 0; i < queue.length; i++) {
    const msg = queue[i];
    if (env.MOCK) {
      log(`[MOCK → #${msg.channel}] ${msg.content.slice(0, 200)}`);
      continue;
    }
    try {
      const channelId = config.CHANNEL_IDS[msg.channel];
      const parts = chunks(msg.content);
      for (let p = 0; p < parts.length; p++) {
        const last = p === parts.length - 1;
        await discord.send(channelId, {
          content: parts[p],
          mention: msg.mention && p === 0 ? state.ownerId : null,
          files: last ? (msg.files ?? []).map((f) => ({ path: toAbs(f.path), name: f.name })) : [],
        });
      }
      if (msg.channel === 'intake') state.chat = [...(state.chat ?? []), { who: 'Bot', text: msg.content.replace(/https?:\S+/g, '[link]').slice(0, 200) }].slice(-10);
    } catch (e) {
      log('Wysyłka nieudana', e.message);
      msg.attempts = (msg.attempts ?? 0) + 1;
      if (msg.attempts < 5) state.outbox.push(msg);
    }
  }
  saveState(state);
}

flush().catch((e) => { console.error(e); process.exit(1); });
