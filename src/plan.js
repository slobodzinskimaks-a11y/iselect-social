// Czysta logika harmonogramu (bez sieci) – łatwa do testowania.
import { addDays, mondayOf, weekdayOf } from './util.js';

export const KIND_INFO = {
  reel_hook: { label: 'Rolka – hook sprzedażowy', format: 'reel', feed: true, auto: false },
  reel_angle: { label: 'Rolka – inny kąt (POV / porównanie)', format: 'reel', feed: true, auto: false },
  carousel_offer: { label: 'Karuzela – oferta', format: 'carousel', feed: true, auto: true },
  carousel_value: { label: 'Karuzela – wiedza do zapisania', format: 'carousel', feed: true, auto: true },
  story: { label: 'Relacja', format: 'story', feed: false, auto: true },
  story_sold: { label: 'Relacja – sprzedane', format: 'story', feed: false, auto: true },
};

// Sloty tygodnia (pon–nd) od daty `fromDate` włącznie.
export function weekSlots(weekStart, weekPlan, fromDate = weekStart) {
  return weekPlan
    .map((p) => ({ date: addDays(weekStart, (p.weekday + 6) % 7), kind: p.kind }))
    .filter((s) => s.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Dla zgłoszenia przyjętego "teraz": który tydzień i od którego dnia generujemy.
// Niedziela → cały następny tydzień. Inny dzień → bieżący tydzień od dziś (jeśli zostało ≥ 3 h na akceptację) lub od jutra.
// Gdy w bieżącym tygodniu zostało < 2 postów/rolek, od razu obejmujemy też cały następny tydzień (nextWeek).
export function targetWindow(local, publishHour, weekPlan) {
  if (local.weekday === 0) {
    const weekStart = addDays(local.date, 1);
    return { weekStart, fromDate: weekStart, nextWeek: false };
  }
  const fromDate = local.hour < publishHour - 3 ? local.date : addDays(local.date, 1);
  const weekStart = mondayOf(fromDate);
  const feedLeft = weekPlan ? weekSlots(weekStart, weekPlan, fromDate).filter((s) => KIND_INFO[s.kind].feed).length : 2;
  return { weekStart, fromDate, nextWeek: feedLeft < 2 };
}

// Wszystkie sloty zadania generowania (bieżący tydzień od fromDate + ewentualnie cały następny).
export function jobSlots(job, weekPlan) {
  const slots = weekSlots(job.weekStart, weekPlan, job.fromDate);
  if (job.nextWeek) slots.push(...weekSlots(addDays(job.weekStart, 7), weekPlan));
  return slots;
}

// Tydzień, na który w niedzielę prosimy o telefon.
export function requestWeek(local) {
  return local.weekday === 0 ? addDays(local.date, 1) : null;
}

const ACTIVE = new Set(['review', 'approved', 'revise', 'generating']);

// Które elementy opublikować teraz. Zasady:
// - tylko w oknie publikacji (np. 21:00–23:59) i tylko zaakceptowane,
// - data elementu ≤ dziś (zaległe zaakceptowane idą przy najbliższej okazji),
// - maks. 1 post/rolka i 1 relacja dziennie.
export function duePublications(items, local, cfg) {
  if (local.hour < cfg.PUBLISH_HOUR || local.hour > cfg.PUBLISH_UNTIL_HOUR) return [];
  const today = local.date;
  const doneToday = (feed) => items.some((it) => (it.status === 'published' || it.status === 'sent')
    && it.publishedDate === today && it.feed === feed);
  const out = [];
  for (const feed of [true, false]) {
    if (doneToday(feed)) continue;
    const next = items
      .filter((it) => it.feed === feed && it.status === 'approved' && it.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
    if (next) out.push(next);
  }
  return out;
}

// Elementy z dzisiejszą datą, które nadal czekają na akceptację (przypomnienie o 21:00).
export function waitingToday(items, local, cfg) {
  if (local.hour < cfg.PUBLISH_HOUR) return [];
  return items.filter((it) => it.date === local.date && ACTIVE.has(it.status) && it.status !== 'approved');
}

export function isWeekday(date, wd) {
  return weekdayOf(date) === wd;
}
