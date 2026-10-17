// Pliki strony akceptacji (GitHub Pages): manifesty szkiców i media.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { KIND_INFO } from './plan.js';
import { addDays, DATA, formatDatePl } from './util.js';

export const SITE = path.join(DATA, 'site');
export const toRel = (abs) => path.relative(SITE, abs).split(path.sep).join('/');
export const toAbs = (rel) => path.join(SITE, ...rel.split('/'));

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

export function itemView(it) {
  const info = KIND_INFO[it.kind];
  return {
    id: it.id,
    kind: it.kind,
    label: info.label,
    format: info.format,
    auto: info.auto,
    date: it.date,
    dateLabel: formatDatePl(it.date),
    status: it.status,
    version: it.version,
    media: it.media,
    caption: it.caption ?? '',
    music: it.spec?.music ?? null,
    angle: it.spec?.angle ?? '',
    notes: it.notes ?? [],
    permalink: it.permalink ?? null,
  };
}

// Zapisuje manifesty wszystkich szkiców. Zwraca true, jeśli coś się zmieniło (trzeba wdrożyć stronę).
export function writeManifests(state) {
  let changed = false;
  const list = [];
  for (const d of Object.values(state.drafts)) {
    const items = d.itemIds.map((id) => state.items[id]).filter(Boolean).filter((it) => it.status !== 'cancelled' && it.media);
    const phone = d.phoneId ? state.phones[d.phoneId] : null;
    const manifest = {
      id: d.id,
      weekStart: d.weekStart,
      mode: d.mode,
      title: d.mode === 'general' ? 'Treści ogólne' : phone ? `${phone.data.model}${phone.data.price ? ` · ${phone.data.price} zł` : ''}` : 'Materiały',
      createdAt: d.createdAt,
      collaborators: config.COLLABORATORS,
      publishHour: config.PUBLISH_HOUR,
      items: items.sort((a, b) => a.date.localeCompare(b.date)).map(itemView),
    };
    changed = writeIfChanged(path.join(SITE, 'drafts', `${d.id}.json`), `${JSON.stringify(manifest, null, 1)}\n`) || changed;
    list.push({ id: d.id, title: manifest.title, weekStart: d.weekStart, createdAt: d.createdAt, count: items.length });
  }
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  changed = writeIfChanged(path.join(SITE, 'drafts', 'index.json'), `${JSON.stringify(list, null, 1)}\n`) || changed;
  return changed;
}

// Sprząta szkice i media starsze niż KEEP_WEEKS tygodni (zdjęcia telefonów zostają jako archiwum – max 12 telefonów).
export function prune(state, today) {
  const limit = addDays(today, -7 * config.KEEP_WEEKS);
  for (const d of Object.values(state.drafts)) {
    if (d.weekStart >= limit) continue;
    for (const id of d.itemIds) delete state.items[id];
    fs.rmSync(path.join(SITE, 'media', 'drafts', d.id), { recursive: true, force: true });
    fs.rmSync(path.join(SITE, 'drafts', `${d.id}.json`), { force: true });
    delete state.drafts[d.id];
  }
  const phones = Object.values(state.phones).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const p of phones.slice(12)) {
    fs.rmSync(path.join(SITE, 'media', 'phones', p.id), { recursive: true, force: true });
    delete state.phones[p.id];
  }
  for (const w of Object.keys(state.weeks)) if (w < limit) delete state.weeks[w];
  for (const w of Object.keys(state.requests)) if (w < limit) delete state.requests[w];
}
