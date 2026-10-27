// Konfiguracja: config.json (jawna, w repozytorium) + klucze z env / .env (tajne).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './util.js';

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

export const config = readJson(path.join(ROOT, 'config.json'));

export const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
  // Webhook kanału #social-log – przez niego strona akceptacji odsyła decyzje.
  REVIEW_WEBHOOK_URL: process.env.REVIEW_WEBHOOK_URL || '',
  IG_ACCESS_TOKEN: process.env.IG_ACCESS_TOKEN || '',
  IG_USER_ID: process.env.IG_USER_ID || '',
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
  PIXABAY_API_KEY: process.env.PIXABAY_API_KEY || '',
  SITE_URL: (process.env.SITE_URL || config.SITE_URL || '').replace(/\/?$/, '/'),
  // MOCK=1: bez Discorda/Gemini/Instagrama (testy i podgląd lokalny).
  MOCK: process.env.MOCK === '1',
};

export function reviewWebhookId() {
  const m = env.REVIEW_WEBHOOK_URL.match(/webhooks\/(\d+)\//);
  return m ? m[1] : '';
}

// Link do strony akceptacji. Klucz webhooka jest w części po '#', więc nie trafia do żadnego serwera.
export function reviewLink(draftId) {
  const key = env.REVIEW_WEBHOOK_URL.split('/webhooks/')[1] || '';
  return `${env.SITE_URL}?d=${encodeURIComponent(draftId)}#k=${key}`;
}

export function siteUrl(rel) {
  return env.SITE_URL + rel.split('/').map(encodeURIComponent).join('/');
}
