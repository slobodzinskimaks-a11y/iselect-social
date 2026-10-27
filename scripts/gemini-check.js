// Szybki test: które modele Gemini działają na tym kluczu (i czy działa wyszukiwarka Google).
import { env } from '../src/config.js';

const models = process.argv.slice(2).length ? process.argv.slice(2) : ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
for (const m of models) {
  for (const search of [false, true]) {
    const body = { contents: [{ role: 'user', parts: [{ text: 'Odpowiedz jednym słowem: OK' }] }] };
    if (search) body.tools = [{ google_search: {} }];
    const t0 = Date.now();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    }).catch((e) => ({ status: 'TIMEOUT', json: async () => ({ error: { message: e.message } }) }));
    process.stdout.write(`(${Math.round((Date.now() - t0) / 1000)} s) `);
    const t = await r.json().catch(() => ({}));
    console.log(`${m}${search ? ' + wyszukiwarka' : ''}: ${r.status} ${t.error?.message?.slice(0, 120) ?? 'OK'}`);
  }
}
