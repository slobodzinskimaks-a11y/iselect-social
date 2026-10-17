// Zadania ciężkie: generowanie pakietu tygodnia, poprawki, relacja "sprzedane". Każde kończy się wiadomością z linkiem do akceptacji.
import fs from 'node:fs';
import path from 'node:path';
import { config, reviewLink } from './config.js';
import { generatePackage, reviseSpec, soldStorySpec } from './content.js';
import { fetchStockClips } from './photos.js';
import { KIND_INFO, weekSlots } from './plan.js';
import { createRenderer } from './render.js';
import { SITE, toAbs, toRel } from './site.js';
import { formatDatePl, log } from './util.js';

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
export async function runGenerate(state, job, { generator = generatePackage } = {}) {
  const slots = weekSlots(job.weekStart, config.WEEK_PLAN, job.fromDate).map((s) => ({ ...s, id: `${s.date}_${s.kind}` }));
  if (!slots.length) return null;
  const slotDates = new Set(slots.map((s) => `${s.date}|${KIND_INFO[s.kind].feed}`));
  for (const it of Object.values(state.items)) {
    if (OPEN.has(it.status) && it.kind !== 'story_sold' && slotDates.has(`${it.date}|${it.feed}`)) it.status = 'cancelled';
  }

  const phone = job.phoneId ? state.phones[job.phoneId] : null;
  const photoRefs = job.mode === 'general' ? archivePhotos(state) : phone.photos;
  const draftId = newDraftId(job.weekStart, job.mode);
  let clipRefs = [];
  if (job.mode === 'general') {
    const clips = await fetchStockClips(['iphone', 'smartphone in hand', 'phone unboxing'], path.join(SITE, 'media', 'drafts', draftId, 'clips'));
    clipRefs = clips.map((c) => toRel(c.file));
  }
  log(`Generuję treści (${job.mode}) na ${slots.length} slotów…`);
  const specs = await generator({
    mode: job.mode,
    phone,
    photos: photoRefs.map((rel) => ({ file: toAbs(rel) })),
    slots,
    perf: state.performance,
    previousHooks: phone ? previousHooks(state, phone.id) : [],
    stockClips: clipRefs.map((rel, i) => ({ file: toAbs(rel), query: ['iphone', 'telefon w dłoni', 'rozpakowanie'][i] ?? 'telefon' })),
    notes: job.notes ?? '',
  });

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
