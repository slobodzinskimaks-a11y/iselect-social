// Podgląd lokalny bez kluczy: przykładowy telefon → pełny tydzień materiałów → strona akceptacji w _preview/.
// Uruchom: npm run demo, potem npm run preview  (z prawdziwym Gemini: $env:DEMO_AI=1; npm run demo)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

process.env.DATA_DIR ||= path.resolve('.work/demo-data');
const { ROOT, DATA, addDays, mondayOf, zoned } = await import('../src/util.js');
const { config } = await import('../src/config.js');
const { normalizeSpec, generatePackage } = await import('../src/content.js');
const { runGenerate } = await import('../src/jobs.js');
const { writeManifests, SITE } = await import('../src/site.js');
const { emptyState, saveState } = await import('../src/state.js');
const { rawPackage } = await import('../test/fixtures.js');

fs.rmSync(DATA, { recursive: true, force: true });
const phoneDir = path.join(SITE, 'media', 'phones', 'demo');
fs.mkdirSync(phoneDir, { recursive: true });
const src = path.join(ROOT, 'demo', 'phone1.jpg');
await sharp(src).resize(1215, 2160).jpeg({ quality: 88 }).toFile(path.join(phoneDir, 'p0.jpg'));
await sharp(src).extract({ left: 560, top: 620, width: 520, height: 650 }).resize(1040, 1300).jpeg({ quality: 88 }).toFile(path.join(phoneDir, 'p1.jpg'));
await sharp(src).extract({ left: 120, top: 520, width: 600, height: 1000 }).jpeg({ quality: 88 }).toFile(path.join(phoneDir, 'p2.jpg'));

const state = emptyState();
state.phones.demo = {
  id: 'demo',
  data: { model: 'iPhone 13 Pro', storage: '128 GB', color: 'Graphite', battery: '100% (po wymianie)', condition: 'pęknięta szybka w rogu, drobne ślady na ramce', defects: ['pęknięta szybka w prawym dolnym rogu', 'drobne ślady na ramce'], kit: ['pudełko', 'kabel USB-C → Lightning', 'etui MagSafe'], price: 1100, extras: '' },
  photos: ['media/phones/demo/p0.jpg', 'media/phones/demo/p1.jpg', 'media/phones/demo/p2.jpg'],
  status: 'available',
  createdAt: new Date().toISOString(),
};

async function mockGenerator({ slots, photos }) {
  const { items } = rawPackage(slots);
  return Object.fromEntries(slots.map((s) => [s.id, normalizeSpec(s.kind, items[s.id], photos.length)]));
}

const local = zoned(new Date(), config.TIMEZONE);
const weekStart = mondayOf(addDays(local.date, 7));
// DEMO_MODE=general – treści ogólne (prawdziwe Gemini, newsy i banki zdjęć; wymaga GEMINI_API_KEY)
const mode = process.env.DEMO_MODE === 'general' ? 'general' : 'phone';
await runGenerate(state, { type: 'generate', mode, phoneId: 'demo', weekStart, fromDate: weekStart },
  mode === 'general' ? {} : { phone: process.env.DEMO_AI === '1' ? generatePackage : mockGenerator });
writeManifests(state);
saveState(state);

const preview = path.join(ROOT, '_preview');
fs.rmSync(preview, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'web'), preview, { recursive: true });
fs.cpSync(SITE, preview, { recursive: true });
const draftId = Object.keys(state.drafts)[0];
console.log(`\nGotowe. Uruchom: npm run preview  →  http://localhost:4173/?d=${draftId}#k=demo`);
