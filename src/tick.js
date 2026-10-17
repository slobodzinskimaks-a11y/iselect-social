// Jeden przebieg bota (GitHub Actions uruchamia go co ~10 min):
// zgłoszenia z Discorda → decyzje ze strony akceptacji → generowanie/poprawki → publikacja o 21:00 → przypomnienia.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, env, reviewLink, reviewWebhookId, siteUrl } from './config.js';
import { extractPhone, missingFields } from './content.js';
import * as discord from './discord.js';
import * as ig from './instagram.js';
import { mention, runGenerate, runRevise, runSoldStory } from './jobs.js';
import { ingestAttachments, isImageAttachment } from './photos.js';
import { duePublications, KIND_INFO, requestWeek, targetWindow, waitingToday } from './plan.js';
import { prune, SITE, toAbs, writeManifests } from './site.js';
import { loadState, saveState } from './state.js';
import { addDays, DATA, daysBetween, formatDatePl, log, mondayOf, slug, zoned } from './util.js';

const CH = config.CHANNEL_IDS ?? {};
const OPEN = new Set(['review', 'approved', 'revise', 'generating']);

function say(state, content, { channel = 'intake', ping = false, files } = {}) {
  state.outbox.push({ channel, content: (ping ? mention(state) : '') + content, mention: ping, files });
}

// ---------------- zgłoszenia (#social-zgłoszenia) ----------------
const REQUEST_TEXT = (weekStart) => `📱 **Nowy tydzień (od ${formatDatePl(weekStart)}) – jaki telefon promujemy?**
Odpisz tutaj jedną lub kilkoma wiadomościami:
\`\`\`
Model:
Pamięć:
Kolor:
Bateria:
Stan / wady:
Cena:
Zestaw:
Dodatkowo:
\`\`\`
+ **4–10 zdjęć** (przód, tył, boki, ekran z kondycją baterii, wady z bliska, telefon z pudełkiem).

Inne odpowiedzi: \`dalej\` – zeszły telefon nadal dostępny (\`dalej 999\` = nowa cena) · \`ogólne\` – w tym tygodniu bez telefonu · \`sprzedany\` – zeszły sprzedany · \`status\` – plan publikacji.
Jeśli nie odpiszesz do poniedziałku ${config.GENERAL_FALLBACK_HOUR}:00, przygotuję treści ogólne (porady, nowości, skup w rozliczeniu).`;

function statusText(state, local) {
  const upcoming = Object.values(state.items)
    .filter((it) => it.date >= addDays(local.date, -1) && it.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);
  const icon = { review: '🟡 do akceptacji', approved: '✅ zaakceptowane', revise: '✏️ w poprawce', published: '📤 opublikowane', sent: '📲 wysłane do Ciebie', failed: '❌ błąd', generating: '⏳' };
  if (!upcoming.length) return 'Brak zaplanowanych publikacji. Wyślij dane telefonu albo napisz `ogólne`.';
  return `📅 **Plan publikacji** (${config.PUBLISH_HOUR}:00)\n${upcoming.map((it) => `• ${formatDatePl(it.date)} – ${KIND_INFO[it.kind].label}: ${icon[it.status] ?? it.status}`).join('\n')}`;
}

async function handleIntake(state, local) {
  const msgs = await discord.readMessages(CH.intake, state.cursors.intake);
  if (!state.cursors.intake) {
    state.cursors.intake = msgs.at(-1)?.id ?? '0';
    return;
  }
  for (const m of msgs) {
    state.cursors.intake = m.id;
    if (m.author?.bot || m.webhook_id) continue;
    state.ownerId ??= m.author.id;
    const text = (m.content ?? '').trim();
    const cmd = m.attachments?.length ? '' : text.toLowerCase();
    if (cmd && cmd.length < 40) {
      if (/^(dalej|nadal|dost[eę]pny)/.test(cmd)) { await commandContinue(state, local, cmd); continue; }
      if (/^(og[oó]lne|brak)/.test(cmd)) { commandGeneral(state, local); continue; }
      if (/^sprzedan/.test(cmd)) { commandSold(state, local); continue; }
      if (/^(status|plan)/.test(cmd)) { say(state, statusText(state, local)); continue; }
      if (/^(pomoc|help)/.test(cmd)) { say(state, REQUEST_TEXT(mondayOf(addDays(local.date, 7)))); continue; }
      if (/^(gotowe|generuj)/.test(cmd)) { state.buffer.force = true; continue; }
    }
    state.buffer.messages.push({
      id: m.id, at: m.timestamp, text,
      attachments: (m.attachments ?? []).map((a) => ({ url: a.url, filename: a.filename, content_type: a.content_type })),
    });
    await discord.react(CH.intake, m.id, '👀');
  }
  await maybeProcessSubmission(state, local);
}

async function maybeProcessSubmission(state, local) {
  const buf = state.buffer;
  if (!buf.messages.length) return;
  const lastAt = new Date(buf.messages.at(-1).at).getTime();
  const quiet = Date.now() - lastAt >= config.SUBMISSION_QUIET_MINUTES * 60000;
  if (!quiet && !buf.force) return;
  const attachments = buf.messages.flatMap((m) => m.attachments).filter(isImageAttachment);
  const text = buf.messages.map((m) => m.text).filter(Boolean).join('\n');
  const askOnce = (key, msg) => {
    if (buf.asked !== key) say(state, msg, { ping: true });
    buf.asked = key;
    buf.force = false;
  };
  if (!attachments.length) return askOnce(`photos-${buf.messages.length}`, 'Mam opis, brakuje **zdjęć** (4–10). Wrzuć je tutaj – resztę zrobię sam.');
  if (!text) return askOnce(`text-${buf.messages.length}`, 'Mam zdjęcia 👍 Dopisz jeszcze **model, cenę, baterię i stan** (wystarczy jedna wiadomość).');
  const data = await extractPhone(text, !env.MOCK);
  const missing = missingFields(data);
  if (missing.includes('model') || missing.includes('cena')) {
    return askOnce(`missing-${buf.messages.length}`, `Brakuje mi: **${missing.join(', ')}**. Dopisz to w kolejnej wiadomości.`);
  }

  const phoneId = `${local.date}-${slug(data.model)}`;
  const files = await ingestAttachments(attachments, path.join(SITE, 'media', 'phones', phoneId), config.MAX_PHOTOS);
  state.phones[phoneId] = { id: phoneId, data, photos: files.map((f) => path.relative(SITE, f).split(path.sep).join('/')), status: 'available', createdAt: new Date().toISOString() };
  state.currentPhoneId = phoneId;
  state.buffer = { messages: [], asked: null };
  const win = targetWindow(local, config.PUBLISH_HOUR);
  state.jobs.push({ type: 'generate', mode: 'phone', phoneId, ...win });
  const warn = missing.length ? `\n⚠️ Bez danych: ${missing.join(', ')} – pominę je w treściach.` : '';
  say(state, `✅ Przyjęte: **${data.model}**, ${data.price} zł, ${files.length} zdjęć. Tworzę materiały od ${formatDatePl(win.fromDate)} (zwykle 5–15 min).${warn}`);
}

async function commandContinue(state, local, cmd) {
  const phone = state.phones[state.currentPhoneId];
  if (!phone) return say(state, 'Nie mam zapisanego telefonu – wyślij dane i zdjęcia.');
  const price = Number(cmd.replace(/[^\d]/g, ''));
  if (price > 50) phone.data.price = price;
  phone.status = 'available';
  const win = targetWindow(local, config.PUBLISH_HOUR);
  state.jobs.push({ type: 'generate', mode: 'continue', phoneId: phone.id, ...win });
  say(state, `👌 ${phone.data.model} dalej w ofercie${price > 50 ? ` (nowa cena: ${price} zł)` : ''}. Przygotuję nowe kąty i hooki.`);
}

function commandGeneral(state, local) {
  const win = targetWindow(local, config.PUBLISH_HOUR);
  state.jobs.push({ type: 'generate', mode: 'general', ...win });
  say(state, '👌 W tym tygodniu treści ogólne – sprawdzę aktualne tematy w internecie i przygotuję materiały.');
}

function commandSold(state, local) {
  const phone = state.phones[state.currentPhoneId];
  if (!phone) return say(state, 'Nie mam zapisanego telefonu do oznaczenia jako sprzedany.');
  phone.status = 'sold';
  let cancelled = 0;
  for (const it of Object.values(state.items)) {
    if (it.phoneId === phone.id && OPEN.has(it.status) && it.kind !== 'story_sold') { it.status = 'cancelled'; cancelled++; }
  }
  const date = local.hour < config.PUBLISH_HOUR - 2 ? local.date : addDays(local.date, 1);
  state.jobs.push({ type: 'sold', phoneId: phone.id, date, weekStart: mondayOf(date) });
  // reszta tygodnia: treści ogólne (w niedzielę i tak przyjdzie prośba o nowy telefon)
  if (local.weekday !== 0) state.jobs.push({ type: 'generate', mode: 'general', weekStart: mondayOf(local.date), fromDate: addDays(local.date, 1) });
  say(state, `🎉 Gratulacje! ${phone.data.model} sprzedany. Wstrzymałem ${cancelled} zaplanowanych materiałów o nim, robię relację „SPRZEDANE”${local.weekday !== 0 ? ' i treści ogólne na resztę tygodnia' : ''}. Masz nowy telefon? Wyślij dane i zdjęcia.`);
}

// ---------------- decyzje ze strony akceptacji (#social-log, przez webhook) ----------------
function parseDecision(m) {
  const raw = m.embeds?.[0]?.description ?? m.content ?? '';
  const json = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? raw;
  try { return JSON.parse(json); } catch { return null; }
}

async function handleDecisions(state) {
  const msgs = await discord.readMessages(CH.log, state.cursors.log);
  if (!state.cursors.log) {
    state.cursors.log = msgs.at(-1)?.id ?? '0';
    return;
  }
  const hookId = reviewWebhookId();
  let approved = 0;
  let revise = 0;
  for (const m of msgs) {
    state.cursors.log = m.id;
    if (!hookId || m.webhook_id !== hookId) continue; // tylko nasza strona akceptacji
    const d = parseDecision(m);
    if (!d?.decisions) continue;
    for (const dec of d.decisions) {
      const it = state.items[dec.item];
      if (!it || it.version !== dec.version || !['review', 'approved'].includes(it.status)) continue;
      if (typeof dec.caption === 'string' && dec.caption.trim()) it.caption = dec.caption.trim().slice(0, 2200);
      if (dec.action === 'approve') { it.status = 'approved'; approved++; }
      if (dec.action === 'revise' && dec.notes?.trim()) {
        it.status = 'revise';
        it.notes.push({ at: new Date().toISOString(), text: dec.notes.trim() });
        state.jobs.push({ type: 'revise', itemId: it.id, notes: dec.notes.trim() });
        revise++;
      }
    }
    await discord.react(CH.log, m.id, '✅');
  }
  if (approved || revise) {
    say(state, `👍 Zapisane: zaakceptowane ${approved}${revise ? `, do poprawki ${revise} (robię nowe wersje)` : ''}. Publikacja o ${config.PUBLISH_HOUR}:00 w zaplanowane dni.`);
  }
}

// ---------------- harmonogram tygodnia ----------------
async function weeklyRoutines(state, local) {
  const ws = requestWeek(local);
  if (ws && local.hour >= config.REQUEST_HOUR && !state.requests[ws]) {
    state.requests[ws] = { at: new Date().toISOString() };
    if (!state.weeks[ws]) say(state, REQUEST_TEXT(ws), { ping: true });
    await weeklyReport(state);
  }
  // poniedziałek 12:00 bez odpowiedzi → treści ogólne
  const thisWeek = mondayOf(local.date);
  if (local.weekday === config.GENERAL_FALLBACK_WEEKDAY && local.hour >= config.GENERAL_FALLBACK_HOUR
    && state.requests[thisWeek] && !state.weeks[thisWeek] && !state.jobs.some((j) => j.weekStart === thisWeek)) {
    state.weeks[thisWeek] = { mode: 'general', pending: true };
    state.jobs.push({ type: 'generate', mode: 'general', weekStart: thisWeek, fromDate: local.date });
    say(state, 'ℹ️ Nie dostałem telefonu na ten tydzień – przygotowuję treści ogólne. Jeśli coś przyjdzie, napisz w każdej chwili, a podmienię kolejne dni.');
  }
}

async function weeklyReport(state) {
  if (env.MOCK || !env.IG_ACCESS_TOKEN) return;
  try {
    const items = await ig.recentPerformance(21);
    state.performance = { updatedAt: new Date().toISOString(), items };
    const week = items.filter((p) => daysBetween(p.date, new Date().toISOString().slice(0, 10)) <= 7);
    if (!week.length) return;
    const sum = (k) => week.reduce((a, p) => a + (p[k] ?? 0), 0);
    const best = [...week].sort((a, b) => b.views - a.views).slice(0, 3);
    say(state, `📊 **Podsumowanie tygodnia**: ${week.length} publikacji · wyświetlenia ${sum('views')} · zasięg ${sum('reach')} · komentarze ${sum('comments')} · zapisy ${sum('saves')} · udostępnienia ${sum('shares')}\n`
      + `Najlepsze:\n${best.map((p) => `• ${p.type}: „${p.hook.slice(0, 70)}” – ${p.views} wyśw.${p.watch_s ? `, śr. oglądanie ${p.watch_s}s` : ''}`).join('\n')}\n`
      + 'Uwzględnię te wyniki przy kolejnych materiałach.');
  } catch (e) {
    log('raport', e.message);
  }
}

// ---------------- zadania ----------------
async function runJobs(state) {
  const jobs = state.jobs;
  state.jobs = [];
  for (const job of jobs) {
    try {
      if (job.type === 'generate') await runGenerate(state, job);
      else if (job.type === 'revise') await runRevise(state, job);
      else if (job.type === 'sold') await runSoldStory(state, job);
      if (job.type === 'generate' && state.weeks[job.weekStart]?.pending) delete state.weeks[job.weekStart].pending;
    } catch (e) {
      log('Zadanie nieudane', job.type, e.stack ?? e.message);
      job.attempts = (job.attempts ?? 0) + 1;
      if (job.attempts < 3) state.jobs.push(job);
      else {
        if (job.type === 'revise' && state.items[job.itemId]) state.items[job.itemId].status = 'review';
        say(state, `❌ Nie udało się (${job.type}) po 3 próbach: ${e.message.slice(0, 300)}`, { ping: true });
      }
    }
  }
}

// ---------------- publikacja ----------------
function reelPackage(state, it) {
  const m = it.spec.music ?? {};
  const collabs = config.COLLABORATORS.map((c) => `@${c}`).join(', ');
  const video = toAbs(it.media.video);
  const big = fs.statSync(video).size > 9.5 * 1024 * 1024;
  say(state,
    `🎬 **Czas na rolkę!** (${KIND_INFO[it.kind].label})\n`
    + `1. Pobierz wideo ${big ? `(link): ${siteUrl(it.media.video)}` : '(poniżej)'} i okładkę.\n`
    + '2. Instagram → ➕ → Rolka → wybierz wideo.\n'
    + `3. 🎵 **Dźwięk** → zakładka *Trendujące* (strzałka ↗). Klimat: **${m.mood ?? 'energiczny'}**, tempo: ${m.tempo ?? 'średnie'}${m.ideas?.length ? `. Szukaj: ${m.ideas.join(' / ')}` : ''}.\n`
    + '4. Wklej opis z następnej wiadomości (przytrzymaj → Kopiuj).\n'
    + `5. **Oznacz osoby → Zaproś współpracowników**: ${collabs}.\n`
    + '6. Okładka: „Dodaj z rolki aparatu” → plik cover.jpg. Udostępnij ✅',
    { channel: 'publish', ping: true, files: [...(big ? [] : [{ path: it.media.video, name: 'rolka.mp4' }]), { path: it.media.cover, name: 'cover.jpg' }] });
  say(state, it.caption, { channel: 'publish' });
}

async function publishDue(state, local) {
  const items = Object.values(state.items);
  for (const it of duePublications(items, local, config)) {
    const format = KIND_INFO[it.kind].format;
    try {
      if (format === 'reel') {
        reelPackage(state, it);
        it.status = 'sent';
      } else if (env.MOCK) {
        log('[MOCK] publikacja', it.id);
        it.status = 'published';
      } else if (format === 'carousel') {
        const r = await ig.publishCarousel(it.media.slides.map(siteUrl), it.caption);
        Object.assign(it, { status: 'published', igMediaId: r.mediaId, permalink: r.permalink });
        say(state, `📤 Opublikowano: **${KIND_INFO[it.kind].label}** ${r.permalink ?? ''}\nWspółtwórcy (${r.collaborators.map((c) => `@${c}`).join(', ') || 'brak'}) muszą zaakceptować zaproszenie w aplikacji.`
          + (r.dropped.length ? `\n⚠️ Instagram nie przyjął: ${r.dropped.map((c) => `@${c}`).join(', ')} – sprawdź w tym koncie: Ustawienia → Prywatność → Tagi i wzmianki → „Zezwalaj na tagi od: wszystkich”.` : ''), { channel: 'publish' });
      } else {
        const r = await ig.publishStory(siteUrl(it.media.image));
        Object.assign(it, { status: 'published', igMediaId: r.mediaId });
        say(state, `📤 Relacja opublikowana: ${it.spec.title}`, { channel: 'publish' });
      }
      it.publishedDate = local.date;
    } catch (e) {
      log('Publikacja nieudana', it.id, e.message);
      it.attempts = (it.attempts ?? 0) + 1;
      if (it.attempts >= 3) {
        it.status = 'failed';
        say(state, `❌ Nie udało się opublikować „${KIND_INFO[it.kind].label}”: ${e.message.slice(0, 300)}`, { channel: 'publish', ping: true });
      }
    }
  }
  for (const it of waitingToday(items, local, config)) {
    const key = `wait-${it.id}`;
    if (state.notified[key]) continue;
    state.notified[key] = local.date;
    say(state, `⏰ Dziś o ${config.PUBLISH_HOUR}:00 miało wyjść: **${KIND_INFO[it.kind].label}** – czeka na Twoją akceptację: ${reviewLink(it.draftId)}\nPo akceptacji wypuszczę to do ${config.PUBLISH_UNTIL_HOUR}:59, a jeśli nie zdążysz – jutro o ${config.PUBLISH_HOUR}:00.`, { ping: true });
  }
}

// ---------------- token Instagrama ----------------
async function maybeRefreshToken(state) {
  if (env.MOCK || !env.IG_ACCESS_TOKEN) return;
  const last = state.ig.tokenRefreshedAt ? new Date(state.ig.tokenRefreshedAt) : null;
  if (last && Date.now() - last < 20 * 86400000) return;
  try {
    const r = await ig.refreshToken();
    fs.writeFileSync(path.join(DATA, '..', '.new_ig_token'), r.access_token);
    state.ig.tokenRefreshedAt = new Date().toISOString();
    log('Token Instagrama odświeżony');
  } catch (e) {
    log('Odświeżenie tokena', e.message);
    if (!state.notified[`token-${new Date().toISOString().slice(0, 10)}`]) {
      state.notified[`token-${new Date().toISOString().slice(0, 10)}`] = true;
      say(state, `⚠️ Nie mogę odświeżyć tokena Instagrama (${e.message.slice(0, 200)}). Jeśli to się powtarza, wygeneruj nowy token (README → „Token Instagrama”).`, { ping: true });
    }
  }
}

// ---------------- przebieg ----------------
export async function tick(now = new Date()) {
  const state = loadState();
  const local = zoned(now, config.TIMEZONE);
  log(`Przebieg ${local.date} ${local.hour}:${String(local.minute).padStart(2, '0')} (${config.TIMEZONE})`);
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { log(`Błąd (${name}):`, e.stack ?? e.message); }
  };
  if (!env.MOCK) {
    await step('zgłoszenia', () => handleIntake(state, local));
    await step('decyzje', () => handleDecisions(state));
    await step('tydzień', () => weeklyRoutines(state, local));
  }
  await step('zadania', () => runJobs(state));
  await step('publikacja', () => publishDue(state, local));
  await step('token', () => maybeRefreshToken(state));
  for (const [k, v] of Object.entries(state.notified)) if (typeof v === 'string' && v < addDays(local.date, -30)) delete state.notified[k];
  prune(state, local.date);
  const changed = writeManifests(state);
  saveState(state);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${changed}\n`);
  log(`Koniec. Strona zmieniona: ${changed}, wiadomości w kolejce: ${state.outbox.length}`);
  return state;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  tick().catch((e) => { console.error(e); process.exit(1); });
}
