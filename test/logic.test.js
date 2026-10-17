import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../src/config.js';
import { missingFields, normalizeSpec, parseLines } from '../src/content.js';
import { duePublications, targetWindow, waitingToday, weekSlots } from '../src/plan.js';
import { mondayOf, stripEmoji, zoned } from '../src/util.js';
import { rawPackage, sampleSpecs } from './fixtures.js';

test('czas w Warszawie (lato i zima)', () => {
  assert.deepEqual(zoned(new Date('2026-10-18T19:05:00Z'), 'Europe/Warsaw'), { date: '2026-10-18', hour: 21, minute: 5, weekday: 0 });
  assert.equal(zoned(new Date('2026-11-02T20:05:00Z'), 'Europe/Warsaw').hour, 21);
});

test('tydzień: co drugi dzień post/rolka, pomiędzy relacje', () => {
  const slots = weekSlots('2026-10-19', config.WEEK_PLAN);
  assert.equal(slots.length, 7);
  assert.deepEqual(slots.filter((s) => !s.kind.startsWith('story')).map((s) => s.date), ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-25']);
  assert.equal(weekSlots('2026-10-19', config.WEEK_PLAN, '2026-10-23').length, 3);
});

test('okno generowania: niedziela → następny tydzień; w tygodniu od dziś lub od jutra', () => {
  assert.deepEqual(targetWindow({ date: '2026-10-18', hour: 10, weekday: 0 }, 21), { weekStart: '2026-10-19', fromDate: '2026-10-19' });
  assert.deepEqual(targetWindow({ date: '2026-10-21', hour: 12, weekday: 3 }, 21), { weekStart: '2026-10-19', fromDate: '2026-10-21' });
  assert.deepEqual(targetWindow({ date: '2026-10-21', hour: 19, weekday: 3 }, 21), { weekStart: '2026-10-19', fromDate: '2026-10-22' });
  assert.equal(mondayOf('2026-10-25'), '2026-10-19');
});

test('publikacja: tylko zaakceptowane, w oknie 21–23, max 1 post i 1 relacja dziennie, zaległe później', () => {
  const it = (id, date, feed, status = 'approved', extra = {}) => ({ id, date, feed, status, ...extra });
  const items = [it('a', '2026-10-19', true), it('b', '2026-10-20', false), it('c', '2026-10-21', true, 'review'), it('d', '2026-10-18', true, 'published', { publishedDate: '2026-10-18' })];
  const at = (date, hour) => ({ date, hour, minute: 0, weekday: 1 });
  assert.deepEqual(duePublications(items, at('2026-10-19', 20), config), []);
  assert.deepEqual(duePublications(items, at('2026-10-19', 21), config).map((x) => x.id), ['a']);
  // wtorek: zaległa rolka z poniedziałku (zaakceptowana później) + relacja
  assert.deepEqual(duePublications(items, at('2026-10-20', 22), config).map((x) => x.id), ['a', 'b']);
  // limit dzienny
  const done = [...items, it('e', '2026-10-20', true, 'published', { publishedDate: '2026-10-20' })];
  assert.deepEqual(duePublications(done, at('2026-10-20', 22), config).map((x) => x.id), ['b']);
  assert.deepEqual(waitingToday(items, at('2026-10-21', 21), config).map((x) => x.id), ['c']);
});

test('parser wiadomości ze zgłoszeniem', () => {
  const d = parseLines('Model: iPhone 14 Pro\nPamięć: 256 GB\nKolor: fioletowy\nBateria: 88%\nStan / wady: rysa na ramce\nCena: 2 300 zł\nZestaw: pudełko, kabel');
  assert.equal(d.model, 'iPhone 14 Pro');
  assert.equal(d.price, 2300);
  assert.deepEqual(d.kit, ['pudełko', 'kabel']);
  assert.deepEqual(missingFields(d), []);
  assert.deepEqual(missingFields(parseLines('iphone 12 ładny')), ['cena', 'kondycja baterii', 'stan / wady']);
});

test('walidacja odpowiedzi AI: emoji, akcent, numery zdjęć, pierwsza scena = hook', () => {
  const reel = normalizeSpec('reel_hook', {
    ...sampleSpecs.reel_hook,
    scenes: [{ kind: 'photo', title: 'Jest haczyk 🔥', accent: 'nie ma', photo: 9, seconds: 9 }, ...sampleSpecs.reel_hook.scenes],
  }, 3);
  assert.equal(reel.scenes[0].kind, 'hook');
  assert.equal(reel.scenes[0].title, 'Jest haczyk');
  assert.equal(reel.scenes[0].accent, '');
  assert.equal(reel.scenes[0].photo, null);
  assert.equal(reel.scenes[0].seconds, 3);
  assert.ok(reel.caption.includes('🤔'), 'emoji zostają w opisie');
  const car = normalizeSpec('carousel_offer', { ...sampleSpecs.carousel_offer, theme: 'pink' }, 3);
  assert.equal(car.theme, 'graphite');
  assert.equal(car.slides[0].kind, 'cover');
  assert.throws(() => normalizeSpec('carousel_value', { slides: [] }, 0));
  assert.equal(stripEmoji('✔ Bateria 100% 🔋'), 'Bateria 100%');
});

test('fixture pokrywa wszystkie rodzaje slotów', () => {
  const slots = weekSlots('2026-10-19', config.WEEK_PLAN).map((s) => ({ ...s, id: `${s.date}_${s.kind}` }));
  const { items } = rawPackage(slots);
  for (const s of slots) assert.ok(normalizeSpec(s.kind, items[s.id], 3));
});
