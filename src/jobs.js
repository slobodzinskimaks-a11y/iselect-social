// Zadania ciężkie: generowanie pakietu tygodnia, poprawki, relacja "sprzedane". Każde kończy się wiadomością z linkiem do akceptacji.
import fs from 'node:fs';
import path from 'node:path';
import { config, reviewLink } from './config.js';
import { generateGeneral, generatePackage, reviseSpec, soldStorySpec } from './content.js';
import { photoCandidates, recentHeadlines, videoCandidate } from './sources.js';
import { jobSlots, KIND_INFO } from './plan.js';
import { createRenderer } from './render.js';
import { SITE, toAbs, toRel } from './site.js';
import { addDays, formatDatePl, log } from './util.js';

const OPEN = new Set(['review', 'approved', 'revise', 'generating']);

export function mention(state) {
  return state.ownerId ? `<@${state.ownerId}> ` : '';
}

export function archivePhotos(state, max = 6) {
  return Object.values(state.phones)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((p) => p.photos.slice(0, 2))
    .filter((rel) => fs.existsSync(toAbs(rel)))
    .slice(0, max);
}

// Tematy/hooki ze wszystkich materiałów z ostatnich ~6 tygodni (anty-powtórki niezależnie od trybu).
function contentHistory(state) {
  return Object.values(state.items)
    .filter((it) => it.spec && it.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((it) => `${KIND_INFO[it.kind]?.label ?? it.kind}: ${it.spec.angle ? `[${it.spec.angle}] ` : ''}${it.spec.scenes?.[0]?.title || it.spec.slides?.[0]?.title || it.spec.title || ''}`)
    .slice(-40);
}

function previousHooks(state, phoneId) {
  return Object.values(state.items)
    .filter((it) => it.phoneId === phoneId && it.spec)
    .map((it) => it.spec.scenes?.[0]?.title || it.spec.slides?.[0]?.title || it.spec.title)
    .filter(Boolean)
    .slice(-12);
}

async function renderInto(renderer, item, draftId, photoRefs, clipRefs) {
  const outDir = path.join(SITE, 'media', 'drafts', draftId, `${item.id}-v${item.version}`);
  const files = await renderer.renderItem(item, {
    photos: photoRefs.map(toAbs),
    clips: clipRefs.map((rel) => ({ file: toAbs(rel) })),
  }, outDir);
  const media = {};
  for (const [k, v] of Object.entries(files)) media[k] = Array.isArray(v) ? v.map(toRel) : toRel(v);
  return media;
}

function newItem({ draftId, slot, mode, phoneId, spec, photoRefs, clipRefs }) {
  const info = KIND_INFO[slot.kind];
  return {
    id: `${slot.date}-${slot.kind}`.replace(/_/g, '-') + `-${draftId.slice(-4)}`,
    draftId,
    date: slot.date,
    kind: slot.kind,
    feed: info.feed,
    mode,
    phoneId: phoneId ?? null,
    status: 'generating',
    version: 1,
    spec,
    caption: spec.caption ?? '',
    photoRefs,
    clipRefs,
    notes: [],
    media: null,
  };
}

function newDraftId(weekStart, mode) {
  return `${weekStart}-${mode}-${Date.now().toString(36).slice(-5)}`;
}

// job: { type: 'generate', mode: 'phone'|'continue'|'general', weekStart, fromDate, phoneId?, notes? }
export async function runGenerate(state, job, generators = {}) {
  const slots = jobSlots(job, config.WEEK_PLAN).map((s) => ({ ...s, id: `${s.date}_${s.kind}` }));
  if (!slots.length) return null;
  const slotDates = new Set(slots.map((s) => `${s.date}|${KIND_INFO[s.kind].feed}`));
  for (const it of Object.values(state.items)) {
    if (OPEN.has(it.status) && it.kind !== 'story_sold' && slotDates.has(`${it.date}|${it.feed}`)) it.status = 'cancelled';
  }

  const phone = job.mode === 'general' ? null : state.phones[job.phoneId];
  const draftId = newDraftId(job.weekStart, job.mode);
  const memory = { preferences: (state.preferences ?? []).map((p) => p.text), history: contentHistory(state) };
  log(`Generuję treści (${job.mode}) na ${slots.length} slotów…`);
  let photoRefs;
  let clipRefs = [];
  let specs;
  if (job.mode === 'general') {
    const mediaDir = path.join(SITE, 'media', 'drafts', draftId, 'src');
    const own = archivePhotos(state, 4);
    const g = await (generators.general ?? generateGeneral)({
      slots, perf: state.performance, notes: job.notes ?? '', ...memory,
      ownPhotos: own.map(toAbs), mediaDir,
      headlines: await recentHeadlines(), findPhotos: photoCandidates, findVideo: videoCandidate,
    });
    photoRefs = g.photos.map((p) => toRel(p.file));
    clipRefs = g.clips.map((c) => toRel(c.file));
    specs = g.specs;
    if (g.credits.length) for (const s of Object.values(specs)) if (s.caption) s.caption += `\n\nZdjęcia: ${g.credits.join('; ')}`;
  } else {
    photoRefs = phone.photos;
    specs = await (generators.phone ?? generatePackage)({
      mode: job.mode,
      phone,
      photos: photoRefs.map((rel) => ({ file: toAbs(rel) })),
      slots,
      perf: state.performance,
      previousHooks: previousHooks(state, phone.id),
      notes: job.notes ?? '',
      ...memory,
    });
  }

  const renderer = await createRenderer([...photoRefs, ...clipRefs].map(toAbs));
  const itemIds = [];
  try {
    for (const slot of slots) {
      const item = newItem({ draftId, slot, mode: job.mode, phoneId: phone?.id, spec: specs[slot.id], photoRefs, clipRefs });
      item.media = await renderInto(renderer, item, draftId, photoRefs, clipRefs);
      item.status = 'review';
      state.items[item.id] = item;
      itemIds.push(item.id);
    }
  } finally {
    renderer.dispose();
  }
  state.drafts[draftId] = { id: draftId, weekStart: job.weekStart, mode: job.mode, phoneId: phone?.id ?? null, createdAt: new Date().toISOString(), itemIds };
  state.weeks[job.weekStart] = { mode: job.mode, phoneId: phone?.id ?? null, draftId };
  if (job.nextWeek) state.weeks[addDays(job.weekStart, 7)] = { mode: job.mode, phoneId: phone?.id ?? null, draftId };

  const first = slots[0].date;
  const last = slots[slots.length - 1].date;
  state.outbox.push({
    channel: 'intake',
    mention: true,
    content: `${mention(state)}🎬 **Materiały gotowe do akceptacji** – ${itemIds.length} szt. (${formatDatePl(first)} → ${formatDatePl(last)}).\n`
      + `Obejrzyj, popraw opisy, kliknij Akceptuj albo Popraw z uwagami:\n${reviewLink(draftId)}`,
  });
  return draftId;
}

// job: { type: 'revise', itemId, notes }
export async function runRevise(state, job, { reviser = reviseSpec } = {}) {
  const item = state.items[job.itemId];
  if (!item || item.status !== 'revise') return;
  const phone = item.phoneId ? state.phones[item.phoneId] : null;
  log(`Poprawka ${item.id}: ${job.notes}`);
  const spec = await reviser({
    kind: item.kind,
    spec: { ...item.spec, caption: item.caption },
    notes: job.notes,
    phone: item.mode === 'general' ? null : phone,
    photos: item.photoRefs.map((rel) => ({ file: toAbs(rel) })),
    stockClips: item.clipRefs,
  });
  const renderer = await createRenderer([...item.photoRefs, ...item.clipRefs].map(toAbs));
  const oldDir = path.join(SITE, 'media', 'drafts', item.draftId, `${item.id}-v${item.version}`);
  try {
    item.spec = spec;
    item.caption = spec.caption ?? '';
    item.version += 1;
    item.media = await renderInto(renderer, item, item.draftId, item.photoRefs, item.clipRefs);
  } finally {
    renderer.dispose();
  }
  fs.rmSync(oldDir, { recursive: true, force: true });
  item.status = 'review';
  state.outbox.push({
    channel: 'intake',
    mention: true,
    content: `${mention(state)}✏️ **Poprawiona wersja**: ${KIND_INFO[item.kind].label} (${formatDatePl(item.date)}).\nSprawdź: ${reviewLink(item.draftId)}`,
  });
}

// job: { type: 'sold', phoneId, date }
export async function runSoldStory(state, job) {
  const phone = state.phones[job.phoneId];
  const photoRefs = phone.photos.slice(0, 1);
  const draftId = newDraftId(job.weekStart, 'sold');
  const item = newItem({ draftId, slot: { date: job.date, kind: 'story_sold' }, mode: 'sold', phoneId: phone.id, spec: soldStorySpec(phone, photoRefs.length ? 0 : null), photoRefs, clipRefs: [] });
  const renderer = await createRenderer(photoRefs.map(toAbs));
  try {
    item.media = await renderInto(renderer, item, draftId, photoRefs, []);
  } finally {
    renderer.dispose();
  }
  item.status = 'review';
  state.items[item.id] = item;
  state.drafts[draftId] = { id: draftId, weekStart: job.weekStart, mode: 'sold', phoneId: phone.id, createdAt: new Date().toISOString(), itemIds: [item.id] };
  state.outbox.push({
    channel: 'intake',
    mention: true,
    content: `${mention(state)}🟢 Relacja „SPRZEDANE” gotowa (${formatDatePl(job.date)}) – zaakceptuj: ${reviewLink(draftId)}`,
  });
}
