// Generowanie treści (Gemini) + walidacja, żeby szablony graficzne zawsze dostały poprawne dane.
import { brandGuide, KIND_BRIEF } from './brand.js';
import { generateJson, imagePart, research } from './gemini.js';
import { KIND_INFO } from './plan.js';
import { formatDatePl, stripEmoji } from './util.js';

const FORMAT = `
FORMAT ODPOWIEDZI – wyłącznie JSON.

Specyfikacja ROLKI (reel_hook, reel_angle):
{ "angle": "krótka nazwa pomysłu",
  "scenes": [ { "kind": "hook|photo|list|price|compare|progress|cta", "photo": <numer zdjęcia albo null>, "video": <numer klipu albo null>,
                "title": "...", "accent": "...", "sub": "...", "items": ["..."],
                "left": {"label": "...", "value": "..."}, "right": {"label": "...", "value": "..."}, "seconds": 1.6 } ],
  "cover": { "title": "...", "accent": "...", "photo": <numer albo null> },
  "caption": "pełny opis posta",
  "music": { "mood": "np. pewny siebie, energiczny", "tempo": "wolne|średnie|szybkie", "ideas": ["2–3 typy utworów / fraz do wyszukania w zakładce Trendujące"] } }
Rodzaje scen: hook = title (+ sub). photo = zdjęcie + title/sub. list = title + items (2–4 punkty, zaczynaj od "+ " dla zalety, "- " dla wady).
price = title (np. "Cena?") + sub = cena (np. "1100 zł"). compare = title + left/right. progress = title + items w formacie "0%|kupiony" (3–6 kroków). cta = title + sub.
Pierwsza scena MUSI być "hook". Razem 7–12 s.

Specyfikacja KARUZELI (carousel_offer, carousel_value):
{ "theme": "graphite|red|green",
  "slides": [ { "kind": "cover|bullets|specs|photo|price|cta|text", "tag": "NAPIS W PIGUŁCE", "title": "...", "accent": "...", "sub": "...",
                "bullets": ["+ zaleta", "- wada", "1. krok"], "specs": [{"label": "Bateria", "value": "100%"}], "photo": <numer albo null> } ],
  "caption": "pełny opis posta" }
Rodzaje slajdów: cover = okładka (bullets: max 3 krótkie atuty jako pigułki). bullets = lista punktów. specs = kafelki label/value (max 6).
photo = zdjęcie + title/sub. price = specs: [{"label": "Cena", "value": "1100 zł"}] + bullets (np. "+ Przyjmujemy w rozliczeniu"). text = title/sub + bullets. cta = title/sub + bullets (dane kontaktowe dodajemy sami).
Pierwszy slajd "cover", ostatni "cta". theme: graphite = domyślny, red = ostrzeżenia/red flagi, green = okazje/porady.

Specyfikacja RELACJI (story):
{ "tag": "...", "title": "...", "accent": "...", "sub": "...", "cta": "...", "photo": <numer albo null> }
`.trim();

function performanceNote(perf) {
  if (!perf?.items?.length) return '';
  const fmt = (p) => `- ${p.type} ${p.date}: "${p.hook}" → zasięg ${p.reach}, wyświetlenia ${p.views}, komentarze ${p.comments}, zapisy ${p.saves}${p.watch_s ? `, śr. oglądanie ${p.watch_s}s` : ''}`;
  const sorted = [...perf.items].sort((a, b) => b.views - a.views);
  return `\nWYNIKI OSTATNICH PUBLIKACJI (powielaj to, co działa; unikaj tego, co słabe):\nNajlepsze:\n${sorted.slice(0, 3).map(fmt).join('\n')}\nNajsłabsze:\n${sorted.slice(-2).map(fmt).join('\n')}\n`;
}

function phoneBlock(phone) {
  const d = phone.data;
  return `
TELEFON NA SPRZEDAŻ (jedyne źródło faktów o egzemplarzu):
- Model: ${d.model}
- Pamięć: ${d.storage || 'brak danych'}
- Kolor: ${d.color || 'brak danych'}
- Kondycja baterii: ${d.battery || 'brak danych'}
- Stan / wady: ${d.condition || 'brak danych'}${d.defects?.length ? ` (wady: ${d.defects.join('; ')})` : ''}
- Zestaw: ${d.kit?.length ? d.kit.join(', ') : 'brak danych'}
- Cena: ${d.price} zł
- Dodatkowo: ${d.extras || '-'}
`.trim();
}

async function photoParts(photos, label) {
  const parts = [];
  for (const [i, p] of photos.entries()) {
    parts.push({ text: `${label} ${i}:` });
    parts.push(await imagePart(p.file));
  }
  return parts;
}

// Pakiet treści na sloty tygodnia. mode: phone | continue | general.
export async function generatePackage({ mode, phone, photos, slots, perf, previousHooks = [], stockClips = [], notes = '' }) {
  const kindSet = mode === 'general' ? KIND_BRIEF.general : KIND_BRIEF.phone;
  let researchText = '';
  if (mode === 'general') {
    const month = new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    researchText = await research(`Jest ${month}. Jesteś researcherem marki sprzedającej używane iPhone'y w Polsce (Dzierżoniów).
Znajdź aktualne, sprawdzone informacje do treści na Instagram: 1) aktualne orientacyjne ceny używanych iPhone'ów 12–17 w Polsce (OLX/Allegro),
2) najnowsze wiadomości Apple/iOS ważne dla zwykłego użytkownika, 3) aktualne oszustwa przy sprzedaży telefonów w Polsce,
4) porady przy zakupie używanego iPhone'a. Podaj zwięzłe fakty z liczbami, po polsku. Zaznacz, czego nie jesteś pewien.`);
  }
  const slotList = slots.map((s) => `- ${s.id}: ${formatDatePl(s.date)} → ${s.kind}: ${kindSet[s.kind] ?? KIND_BRIEF.phone.story}`).join('\n');
  const prompt = `
${mode === 'general' ? `W tym tygodniu NIE MA telefonu na sprzedaż. Tworzysz treści ogólne, które budują zasięg i zaufanie, a w CTA zapraszają do kontaktu („szukasz iPhone'a? napisz, jaki model”).
RESEARCH (aktualne informacje z internetu – używaj tylko pewnych faktów, bez wymyślania liczb):
${researchText}` : phoneBlock(phone)}
${mode === 'continue' ? `\nTen telefon był już promowany w poprzednich tygodniach i nadal jest dostępny. Użyj NOWYCH kątów i hooków. Nie powtarzaj tych hooków:\n${previousHooks.map((h) => `- ${h}`).join('\n')}` : ''}
${notes ? `\nUWAGI WŁAŚCICIELA: ${notes}` : ''}
${performanceNote(perf)}
${photos.length ? `\nZDJĘCIA: poniżej ${photos.length} zdjęć (numery 0–${photos.length - 1}). ${mode === 'general' ? 'To zdjęcia telefonów z naszego archiwum – używaj jako tła.' : 'Wybieraj najlepsze ujęcia: na okładki i hooki ostre, efektowne zdjęcie całego telefonu; wady pokazuj zdjęciami wad. Nie używaj tego samego zdjęcia w dwóch scenach z rzędu.'}` : '\nBRAK ZDJĘĆ: ustaw "photo": null wszędzie (grafiki będą typograficzne).'}
${stockClips.length ? `\nKLIPY WIDEO (numery 0–${stockClips.length - 1}) do użycia w rolkach jako tło przez pole "video": ${stockClips.map((c, i) => `${i}: ${c.query}`).join('; ')}` : ''}

SLOTY DO WYPEŁNIENIA (każdy inny, razem mają tworzyć spójny tydzień, który prowadzi do sprzedaży):
${slotList}

Zwróć JSON: { "items": { "<id slotu>": <specyfikacja zgodna z formatem dla danego rodzaju> } }

${FORMAT}`.trim();

  const out = await generateJson({
    system: brandGuide(),
    parts: [{ text: prompt }, ...(await photoParts(photos, 'Zdjęcie'))],
  });
  const items = out.items ?? out;
  const result = {};
  for (const s of slots) {
    if (!items[s.id]) throw new Error(`Gemini nie przygotował slotu ${s.id}`);
    result[s.id] = normalizeSpec(s.kind, items[s.id], photos.length, stockClips.length);
  }
  return result;
}

// Poprawka jednego elementu wg uwag właściciela.
export async function reviseSpec({ kind, spec, notes, phone, photos, stockClips = [] }) {
  const prompt = `
Popraw ten materiał (${KIND_INFO[kind].label}) zgodnie z uwagami właściciela. Zachowaj to, czego uwagi nie dotyczą, chyba że trzeba zmienić całość.
UWAGI: ${notes}

${phone ? phoneBlock(phone) : 'Materiał ogólny (bez konkretnego telefonu).'}

OBECNA WERSJA:
${JSON.stringify(spec, null, 1)}

${photos.length ? `Zdjęcia: numery 0–${photos.length - 1} (poniżej).` : 'Brak zdjęć – "photo": null.'}
Zwróć JSON: { "spec": <poprawiona specyfikacja w tym samym formacie> }

${FORMAT}`.trim();
  const out = await generateJson({ system: brandGuide(), parts: [{ text: prompt }, ...(await photoParts(photos, 'Zdjęcie'))], temperature: 0.7 });
  return normalizeSpec(kind, out.spec ?? out, photos.length, stockClips.length);
}

// Odczyt danych telefonu z luźnej wiadomości (Gemini, a gdy się nie uda – prosty parser linii "Pole: wartość").
export async function extractPhone(text, useAi = true) {
  const basic = parseLines(text);
  if (!useAi) return basic;
  try {
    const out = await generateJson({
      system: 'Wyciągasz dane telefonu z wiadomości sprzedawcy. Nie zgaduj – brak danych = pusty tekst / pusta lista. Odpowiadasz wyłącznie JSON-em.',
      parts: [{ text: `Wiadomość:\n"""${text}"""\n\nZwróć JSON: {"model": "np. iPhone 13 Pro", "storage": "np. 128 GB", "color": "", "battery": "np. 87%", "condition": "opis stanu", "defects": ["..."], "kit": ["..."], "price": <liczba zł albo null>, "extras": "inne ważne informacje"}` }],
      temperature: 0.1,
    });
    const merged = { ...basic };
    for (const [k, v] of Object.entries(out)) {
      if (v !== null && v !== '' && !(Array.isArray(v) && !v.length)) merged[k] = v;
    }
    merged.price = Number(String(merged.price ?? '').replace(/[^\d]/g, '')) || null;
    return merged;
  } catch {
    return basic;
  }
}

export function parseLines(text) {
  const get = (re) => (text.match(re)?.[1] ?? '').trim();
  const price = get(/cena\s*[:=-]\s*([^\n]+)/i);
  return {
    model: get(/model\s*[:=-]\s*([^\n]+)/i) || (text.match(/iphone\s*\d{1,2}\s*(?:pro max|pro|plus|mini|max|e)?/i)?.[0] ?? ''),
    storage: get(/(?:pamięć|pamiec|pojemność)\s*[:=-]\s*([^\n]+)/i),
    color: get(/kolor\s*[:=-]\s*([^\n]+)/i),
    battery: get(/bateri[ai]\s*[:=-]\s*([^\n]+)/i),
    condition: get(/(?:stan|wady)[^:\n]*[:=-]\s*([^\n]+)/i),
    defects: [],
    kit: get(/zestaw\s*[:=-]\s*([^\n]+)/i).split(/[,;]/).map((s) => s.trim()).filter(Boolean),
    price: Number(price.replace(/[^\d]/g, '')) || null,
    extras: get(/dodatkowo\s*[:=-]\s*([^\n]+)/i),
  };
}

export function missingFields(data) {
  const missing = [];
  if (!data.model) missing.push('model');
  if (!data.price) missing.push('cena');
  if (!data.battery) missing.push('kondycja baterii');
  if (!data.condition && !data.defects?.length) missing.push('stan / wady');
  return missing;
}

// ---------- walidacja ----------
const clip = (s, n) => stripEmoji(s).slice(0, n);
const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);

function accentOf(title, accent) {
  const a = stripEmoji(accent);
  return a && title.toLowerCase().includes(a.toLowerCase()) ? a : '';
}

export function normalizeSpec(kind, spec, nPhotos, nClips = 0) {
  const format = KIND_INFO[kind].format;
  if (format === 'reel') {
    const kinds = new Set(['hook', 'photo', 'list', 'price', 'compare', 'progress', 'cta']);
    let scenes = (spec.scenes ?? []).filter((s) => s && kinds.has(s.kind)).slice(0, 7).map((s) => {
      const title = clip(s.title, 70);
      return {
        kind: s.kind,
        photo: idx(s.photo, nPhotos),
        video: idx(s.video, nClips),
        title,
        accent: accentOf(title, s.accent),
        sub: clip(s.sub, 90),
        items: (s.items ?? []).slice(0, 6).map((x) => clip(x, 60)).filter(Boolean),
        left: s.left ? { label: clip(s.left.label, 24), value: clip(s.left.value, 20) } : null,
        right: s.right ? { label: clip(s.right.label, 24), value: clip(s.right.value, 20) } : null,
        seconds: Math.min(3, Math.max(1, Number(s.seconds) || 1.6)),
      };
    });
    if (!scenes.length) throw new Error('Rolka bez scen');
    if (scenes[0].kind !== 'hook') scenes[0].kind = 'hook';
    scenes = scenes.map((s) => (s.kind === 'compare' && !(s.left && s.right) ? { ...s, kind: 'photo' } : s));
    const coverTitle = clip(spec.cover?.title || scenes[0].title, 60);
    return {
      angle: clip(spec.angle, 60),
      scenes,
      cover: { title: coverTitle, accent: accentOf(coverTitle, spec.cover?.accent || scenes[0].accent), photo: idx(spec.cover?.photo, nPhotos) ?? scenes[0].photo },
      caption: String(spec.caption ?? '').trim().slice(0, 2200),
      music: {
        mood: String(spec.music?.mood ?? 'energiczny').slice(0, 80),
        tempo: String(spec.music?.tempo ?? 'średnie').slice(0, 20),
        ideas: (spec.music?.ideas ?? []).slice(0, 3).map((x) => String(x).slice(0, 80)),
      },
    };
  }
  if (format === 'carousel') {
    const kinds = new Set(['cover', 'bullets', 'specs', 'photo', 'price', 'cta', 'text']);
    const slides = (spec.slides ?? []).filter((s) => s && kinds.has(s.kind)).slice(0, 10).map((s) => {
      const title = clip(s.title, 80);
      return {
        kind: s.kind,
        tag: clip(s.tag, 28).toUpperCase(),
        title,
        accent: accentOf(title, s.accent),
        sub: clip(s.sub, 160),
        bullets: (s.bullets ?? []).slice(0, 6).map((x) => clip(x, 90)).filter(Boolean),
        specs: (s.specs ?? []).slice(0, 6).map((x) => ({ label: clip(x.label, 22), value: clip(x.value, 26) })),
        photo: idx(s.photo, nPhotos),
      };
    });
    if (slides.length < 2) throw new Error('Karuzela ma za mało slajdów');
    slides[0].kind = 'cover';
    return {
      theme: ['graphite', 'red', 'green'].includes(spec.theme) ? spec.theme : 'graphite',
      slides,
      caption: String(spec.caption ?? '').trim().slice(0, 2200),
    };
  }
  const title = clip(spec.title, 60);
  return {
    tag: clip(spec.tag, 28).toUpperCase(),
    title,
    accent: accentOf(title, spec.accent),
    sub: clip(spec.sub, 110),
    cta: clip(spec.cta || 'Napisz na DM', 40),
    photo: idx(spec.photo, nPhotos),
  };
}

// Relacja „SPRZEDANE” – szablon bez AI.
export function soldStorySpec(phone, heroIndex) {
  return normalizeSpec('story_sold', {
    tag: 'SPRZEDANE',
    title: `${phone.data.model} sprzedany`,
    accent: 'sprzedany',
    sub: 'Dziękujemy! Szukasz podobnego? Znajdziemy go dla Ciebie.',
    cta: 'Napisz, jakiego szukasz',
    photo: heroIndex,
  }, 99);
}
