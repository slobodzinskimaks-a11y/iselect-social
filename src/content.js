// Generowanie treści (Gemini) + walidacja, żeby szablony graficzne zawsze dostały poprawne dane.
import { brandGuide, HOOK_FORMATS, KIND_BRIEF } from './brand.js';
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

// Stałe wskazówki właściciela + lista tego, co już było (żeby się nie powtarzać).
function memoryBlock({ preferences = [], history = [] }) {
  return [
    preferences.length ? `\nSTAŁE WSKAZÓWKI WŁAŚCICIELA (zawsze ich przestrzegaj):\n${preferences.map((p) => `- ${p}`).join('\n')}` : '',
    history.length ? `\nTO JUŻ BYŁO W OSTATNICH TYGODNIACH – NIE POWTARZAJ tych tematów, hooków ani formatów:\n${history.map((h) => `- ${h}`).join('\n')}` : '',
  ].join('\n');
}

// Pakiet treści o konkretnym telefonie. mode: phone | continue.
export async function generatePackage({ mode, phone, photos, slots, perf, previousHooks = [], notes = '', preferences = [], history = [] }) {
  const slotList = slots.map((s) => `- ${s.id}: ${formatDatePl(s.date)} → ${s.kind}: ${KIND_BRIEF.phone[s.kind] ?? KIND_BRIEF.phone.story}`).join('\n');
  const prompt = `
${phoneBlock(phone)}
${mode === 'continue' ? `\nTen telefon był już promowany w poprzednich tygodniach i nadal jest dostępny. Użyj NOWYCH kątów i hooków. Nie powtarzaj tych hooków:\n${previousHooks.map((h) => `- ${h}`).join('\n')}` : ''}
${notes ? `\nUWAGI WŁAŚCICIELA DO TEGO PAKIETU: ${notes}` : ''}
${memoryBlock({ preferences, history })}
${performanceNote(perf)}
${photos.length ? `\nZDJĘCIA: poniżej ${photos.length} zdjęć (numery 0–${photos.length - 1}). Wybieraj najlepsze ujęcia: na okładki i hooki ostre, efektowne zdjęcie całego telefonu; wady pokazuj zdjęciami wad. Nie używaj tego samego zdjęcia w dwóch scenach z rzędu.` : '\nBRAK ZDJĘĆ: ustaw "photo": null wszędzie.'}

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
    result[s.id] = normalizeSpec(s.kind, items[s.id], photos.length);
  }
  return result;
}

// ---------- treści ogólne (bez konkretnego telefonu) ----------
// Krok 1: research (newsy z RSS + wyszukiwarka) → krok 2: plan z opisem zdjęcia do każdego slajdu/sceny
// → krok 3: bot szuka zdjęć/filmów w legalnych bankach, AI wybiera najlepiej pasujące → specyfikacje z numerami zdjęć.
export async function generateGeneral({ slots, perf, notes = '', preferences = [], history = [], ownPhotos = [], mediaDir, headlines, findPhotos, findVideo }) {
  const month = new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const researchText = await research(`Jest ${month}. Jesteś researcherem i strategiem treści konta na Instagramie o iPhone'ach (sklep z używanymi iPhone'ami, Polska).
Oto świeże nagłówki z serwisów technologicznych:
${headlines.map((h) => `- [${h.source}, ${h.date}] ${h.title}${h.desc ? ` — ${h.desc}` : ''}`).join('\n') || '- (brak)'}

Zadanie: wybierz 6–8 tematów, które TERAZ najbardziej zaciekawią Polaków kupujących lub używających iPhone'a
(nowości Apple/iOS z nagłówków, ceny, porównania modeli, oszustwa, triki, mity, ponadczasowe porady).
Do każdego tematu dopisz konkretne fakty – TYLKO z nagłówków powyżej albo powszechnie znane i pewne. Zaznacz, czego nie jesteś pewien
(takich rzeczy nie podawaj jako faktów). Po polsku, zwięźle.`);

  const slotList = slots.map((s) => `- ${s.id}: ${formatDatePl(s.date)} → ${s.kind}: ${KIND_BRIEF.general[s.kind] ?? KIND_BRIEF.general.story}`).join('\n');
  const prompt = `
W tym tygodniu NIE promujemy konkretnego telefonu. Tworzysz TREŚCI OGÓLNE w stylu profesjonalnego magazynu technologicznego:
budują zasięg, zaufanie i pozycję eksperta, a CTA zaprasza do kontaktu („szukasz iPhone'a? napisz, jaki model – znajdziemy”).
NIE wspominaj o żadnym konkretnym egzemplarzu z naszej oferty ani jego cenie. Nie używaj słowa „gwarancja” w żadnym kontekście.
KAŻDY materiał tygodnia na INNY temat (ten sam temat/produkt może pojawić się najwyżej raz w tygodniu) i w INNYM formacie hooka.
Dodaj do każdej specyfikacji pole "topic" – krótka nazwa tematu.

RESEARCH (używaj tylko pewnych faktów, bez wymyślania liczb):
${researchText}

FORMATY HOOKÓW, które teraz działają (każdy materiał w tygodniu w INNYM formacie):
${HOOK_FORMATS.map((h) => `- ${h}`).join('\n')}
${notes ? `\nUWAGI WŁAŚCICIELA DO TEGO PAKIETU: ${notes}` : ''}
${memoryBlock({ preferences, history })}
${performanceNote(perf)}

ZDJĘCIA: każdy slajd karuzeli, każda relacja i każda scena rolki MUSI mieć tło. Zamiast numeru zdjęcia podaj:
- "image_query": krótkie zapytanie PO ANGIELSKU do banku zdjęć, opisujące konkretny, estetyczny kadr pasujący do treści slajdu
  (np. "iphone on wooden desk minimal", "person holding smartphone city night", "phone battery charging close up", "apple store interior").
  Unikaj zapytań o logo i konkretne reklamy. Różne slajdy = różne zapytania.
${ownPhotos.length ? `- albo "own_photo": numer 0–${ownPhotos.length - 1} – nasze własne zdjęcia telefonów (tylko gdy slajd mówi o naszej ofercie / skupie).` : ''}
- w rolkach dodatkowo możesz podać "video_query" (po angielsku) – krótki pionowy klip jako tło sceny (np. "scrolling phone hands", "unboxing smartphone").
Pole "photo" pomiń.
Karuzele i relacje: "theme": "editorial". Pole "tag" = kategoria materiału, np. PORADNIK, NEWS, RANKING, MIT CZY FAKT, TRIK, PORÓWNANIE.

SLOTY DO WYPEŁNIENIA (każdy na inny temat, razem spójny tydzień):
${slotList}

Zwróć JSON: { "items": { "<id slotu>": <specyfikacja> } }

${FORMAT}`.trim();

  const out = await generateJson({ system: brandGuide(), parts: [{ text: prompt }] });
  const raw = out.items ?? out;
  for (const s of slots) if (!raw[s.id]) throw new Error(`Gemini nie przygotował slotu ${s.id}`);

  // --- dobór zdjęć ---
  const targets = []; // { key, text, query, own, set(photoIndex) }
  for (const s of slots) {
    const spec = raw[s.id];
    const units = KIND_INFO[s.kind].format === 'reel' ? (spec.scenes ?? []) : KIND_INFO[s.kind].format === 'carousel' ? (spec.slides ?? []) : [spec];
    units.forEach((u, i) => targets.push({ key: `${s.id}#${i}`, unit: u, text: [u.title, u.sub, ...(u.items ?? u.bullets ?? [])].filter(Boolean).join(' · '), query: u.image_query, own: u.own_photo }));
  }
  const photos = [...ownPhotos.map((file) => ({ file }))];
  const queries = [...new Set(targets.map((t) => t.query).filter(Boolean))].slice(0, 24);
  const candidates = {};
  for (const q of queries) candidates[q] = await findPhotos(q, mediaDir);

  // AI ocenia kandydatów i wybiera najlepiej pasujące zdjęcie do każdego slajdu
  const choiceParts = [{ text: `Do każdego slajdu wybierz zdjęcie, które NAJLEPIEJ pasuje do jego treści i wygląda profesjonalnie (ostre, estetyczne, bez napisów, bez cudzych logo na pierwszym planie, bez osób w dziwnych pozach).
Jeśli żaden kandydat nie pasuje, wybierz -1. Zwróć JSON: { "choices": { "<klucz slajdu>": <numer kandydata albo -1> } }` }];
  for (const t of targets) {
    const c = t.query ? candidates[t.query] ?? [] : [];
    if (!c.length) continue;
    choiceParts.push({ text: `\nSLAJD ${t.key}: ${t.text}\nKandydaci:` });
    for (const [i, cand] of c.entries()) {
      choiceParts.push({ text: `[${i}]` });
      choiceParts.push(await imagePart(cand.file));
    }
  }
  let choices = {};
  if (choiceParts.length > 1) {
    try {
      choices = (await generateJson({ system: 'Jesteś art directorem marki premium. Odpowiadasz wyłącznie JSON-em.', parts: choiceParts, temperature: 0.2 })).choices ?? {};
    } catch {
      choices = {};
    }
  }
  const indexOf = new Map();
  const credits = new Set();
  const use = (cand) => {
    if (!indexOf.has(cand.file)) { indexOf.set(cand.file, photos.length); photos.push(cand); }
    if (cand.credit && cand.source === 'openverse') credits.add(cand.credit);
    return indexOf.get(cand.file);
  };
  // Zapas neutralnych, eleganckich zdjęć – gdy AI odrzuci kandydatów (zamiast wstawiać nasz telefon)
  let pool = null;
  let poolNext = 0;
  const neutral = async () => {
    if (!pool) {
      pool = [];
      for (const q of ['smartphone minimal dark background', 'hand holding smartphone', 'iphone on desk']) pool.push(...await findPhotos(q, mediaDir));
    }
    return pool.length ? pool[poolNext++ % pool.length] : null;
  };
  for (const t of targets) {
    delete t.unit.photo;
    if (Number.isInteger(t.own) && t.own >= 0 && t.own < ownPhotos.length) { t.unit.photo = t.own; continue; }
    const c = t.query ? candidates[t.query] ?? [] : [];
    const pick = Number.isInteger(choices[t.key]) ? choices[t.key] : 0;
    const cand = pick >= 0 && pick < c.length ? c[pick] : pick === -1 ? null : c[0];
    const chosen = cand ?? await neutral();
    t.unit.photo = chosen ? use(chosen) : null;
  }

  // --- klipy do rolek ---
  const clips = [];
  const clipIndex = new Map();
  for (const s of slots.filter((x) => KIND_INFO[x.kind].format === 'reel')) {
    for (const sc of raw[s.id].scenes ?? []) {
      if (!sc.video_query || clips.length >= 6) continue;
      if (!clipIndex.has(sc.video_query)) {
        const v = await findVideo(sc.video_query, mediaDir);
        clipIndex.set(sc.video_query, v ? clips.push(v) - 1 : null);
      }
      sc.video = clipIndex.get(sc.video_query);
    }
  }

  const result = {};
  for (const s of slots) {
    const spec = raw[s.id];
    if (KIND_INFO[s.kind].format !== 'reel') spec.theme = 'editorial';
    else spec.style = 'editorial';
    result[s.id] = normalizeSpec(s.kind, spec, photos.length, clips.length);
  }
  return { specs: result, photos, clips, credits: [...credits] };
}

// ---------- rozumienie wiadomości ----------
// Zwykła wiadomość bez zdjęć → intencja (żeby „Dalej”, „zmień wszystko”, „zrób ogólne” działały naturalnie).
export async function classifyMessage(text, ctx) {
  const out = await generateJson({
    system: 'Jesteś asystentem bota social media sklepu z używanymi iPhone’ami. Rozpoznajesz, czego chce właściciel. Odpowiadasz wyłącznie JSON-em.',
    parts: [{ text: `KONTEKST:
- Aktualnie zaplanowane treści: ${ctx.currentMode ?? 'brak'}${ctx.currentPhone ? ` (telefon: ${ctx.currentPhone})` : ''}
- Zgłoszenie telefonu w toku: ${ctx.bufferPhotos ? `tak, ${ctx.bufferPhotos} zdjęć` : 'nie'}
- Ostatnie wiadomości (od najstarszej):
${ctx.recent.map((m) => `  ${m.who}: ${m.text}`).join('\n')}

NOWA WIADOMOŚĆ WŁAŚCICIELA: """${text}"""

Rozpoznaj intencję:
- "general" – chce treści ogólnych (bez konkretnego telefonu)
- "same_phone" – ten sam telefon nadal na sprzedaż, chce nowych treści o nim (ew. nowa cena)
- "sold" – telefon sprzedany
- "feedback" – uwagi do obecnych/przyszłych materiałów, chce zmian (np. „zmień wszystko”, „nie powtarzaj się”, „ładniejsze zdjęcia”)
- "phone_data" – podaje dane telefonu do zgłoszenia (model, cena, bateria…)
- "status" – pyta o plan publikacji
- "other" – pytanie lub coś innego
Zwróć JSON: { "intent": "...", "mode": "general|same_phone|null (dla feedback: w jakim trybie robić nowe treści; null = bez zmiany)",
"notes": "uwagi do zastosowania przy tworzeniu (po polsku, konkretnie)", "remember": "stała zasada na przyszłe tygodnie albo pusty tekst",
"price": <nowa cena albo null>, "reply": "krótka, ludzka odpowiedź do właściciela po polsku" }` }],
    temperature: 0.1,
  });
  return out;
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
      style: spec.style === 'editorial' ? 'editorial' : 'classic',
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
      theme: ['graphite', 'red', 'green', 'editorial'].includes(spec.theme) ? spec.theme : 'graphite',
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
    cta: clip(spec.cta || 'Napisz na DM', 26),
    photo: idx(spec.photo, nPhotos),
    theme: spec.theme === 'editorial' ? 'editorial' : undefined,
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
