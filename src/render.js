// Renderowanie grafik i rolek z szablonów w folderze remotion/.
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { config } from './config.js';
import { KIND_INFO } from './plan.js';
import { log, ROOT } from './util.js';

// Na Windowsie ścieżka do Chrome bywa za długa (limit 260 znaków) – wtedy wskaż krótszą przez BROWSER_EXECUTABLE.
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
const brand = () => ({ ig: config.IG_USERNAME, city: config.CITY, delivery: config.DELIVERY, tradeIn: config.TRADE_IN });

// assets: lista plików (zdjęcia, klipy) używanych w tym przebiegu – trafiają do katalogu public szablonów.
export async function createRenderer(assets) {
  const publicDir = path.join(ROOT, '.work', `public-${Date.now()}`);
  fs.mkdirSync(publicDir, { recursive: true });
  const map = new Map();
  assets.forEach((file, i) => {
    const rel = `a${i}${path.extname(file).toLowerCase()}`;
    fs.copyFileSync(file, path.join(publicDir, rel));
    map.set(file, rel);
  });
  log('Pakowanie szablonów…');
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'remotion', 'Root.jsx'), publicDir });
  const rel = (files) => files.map((f) => map.get(f));

  async function still(id, inputProps, output) {
    const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await renderStill({ serveUrl, composition, inputProps, output, imageFormat: 'jpeg', jpegQuality: 92, browserExecutable });
    return output;
  }

  // Renderuje element do outDir. Zwraca ścieżki plików (absolutne).
  async function renderItem(item, { photos, clips = [] }, outDir) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const common = { photos: rel(photos), brand: brand() };
    const format = KIND_INFO[item.kind].format;
    const spec = item.spec;
    if (format === 'carousel') {
      const slides = [];
      for (let i = 0; i < spec.slides.length; i++) {
        slides.push(await still('Slide', { ...common, slide: spec.slides[i], index: i, total: spec.slides.length, theme: spec.theme },
          path.join(outDir, `slide${String(i + 1).padStart(2, '0')}.jpg`)));
      }
      return { slides };
    }
    if (format === 'story') {
      const theme = item.kind === 'story_sold' ? 'green' : 'graphite';
      return { image: await still('Story', { ...common, story: spec, theme }, path.join(outDir, 'story.jpg')) };
    }
    const inputProps = { ...common, spec, theme: 'graphite', clips: rel(clips.map((c) => c.file)) };
    const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps, browserExecutable });
    const video = path.join(outDir, 'reel.mp4');
    log(`Render rolki ${item.id} (${composition.durationInFrames} klatek)…`);
    await renderMedia({ serveUrl, composition, inputProps, codec: 'h264', crf: 21, pixelFormat: 'yuv420p', outputLocation: video, muted: true, browserExecutable });
    const cover = await still('ReelCover', { ...common, spec, theme: 'graphite' }, path.join(outDir, 'cover.jpg'));
    return { video, cover };
  }

  return {
    renderItem,
    dispose: () => fs.rmSync(publicDir, { recursive: true, force: true }),
  };
}
