// Darmowe Gemini API: tekst + zdjęcia → JSON, opcjonalnie z wyszukiwarką Google (aktualne tematy).
import fs from 'node:fs';
import sharp from 'sharp';
import { config, env } from './config.js';
import { log, sleep } from './util.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Do AI wysyłamy pomniejszone kopie (≤ 768 px) – 40 zdjęć mieści się wtedy w jednym zapytaniu.
export async function imagePart(file) {
  const data = await sharp(fs.readFileSync(file)).resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  return { inline_data: { mime_type: 'image/jpeg', data: data.toString('base64') } };
}

async function request(model, body) {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Gemini ${model}: ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = JSON.parse(text);
  const cand = data.candidates?.[0];
  const out = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!out) throw Object.assign(new Error(`Gemini ${model}: pusta odpowiedź (${cand?.finishReason ?? data.promptFeedback?.blockReason})`), { status: 500 });
  return out;
}

// Próbuje kolejnych modeli z config.GEMINI_MODELS (nieistniejący / przeciążony → następny).
async function withFallback(body) {
  let last;
  for (const model of config.GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await request(model, body);
      } catch (e) {
        last = e;
        log(e.message);
        if (e.status === 404 || e.status === 400) break; // model niedostępny / nieobsługiwana opcja
        if (e.status === 429) break; // limit tego modelu – od razu następny
        await sleep(3000);
      }
    }
  }
  throw last;
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error(`Gemini zwrócił niepoprawny JSON: ${cleaned.slice(0, 200)}`);
  }
}

export async function generateJson({ system, parts, temperature = 0.9 }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, responseMimeType: 'application/json', maxOutputTokens: 16384 },
  };
  return parseJson(await withFallback(body));
}

// Badanie tematu z Google Search (zwraca zwykły tekst z faktami).
export async function research(prompt) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
  };
  try {
    return await withFallback(body);
  } catch (e) {
    log('research bez wyszukiwarki:', e.message);
    delete body.tools;
    return withFallback(body);
  }
}
