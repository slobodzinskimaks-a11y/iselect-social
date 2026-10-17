// Drobne narzędzia: czas w strefie Warszawy, daty bez godzin, pliki.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Dane (pamięć bota + pliki strony) leżą w osobnej gałęzi `data`, pobieranej do tego folderu.
export const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export const WEEKDAY_PL = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

// Czas lokalny w danej strefie: { date: 'YYYY-MM-DD', hour, minute, weekday }.
export function zoned(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

// Arytmetyka na datach 'YYYY-MM-DD' (bez stref – liczymy w UTC).
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekdayOf(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
// Poniedziałek tygodnia (pon–nd), do którego należy data.
export function mondayOf(date) {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}
export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}
export function formatDatePl(date) {
  const [, m, d] = date.split('-');
  return `${WEEKDAY_PL[weekdayOf(date)]} ${Number(d)}.${m}`;
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw e;
  }
}
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

// Usuwa emoji i znaki, których czcionka na serwerze może nie mieć (tekst na grafikach).
export function stripEmoji(s) {
  return String(s ?? '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/[✔✓✅]/g, '')
    .replace(/[✖✗❌]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
