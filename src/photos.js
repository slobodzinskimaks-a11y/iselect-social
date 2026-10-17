// Zdjęcia: pobranie z Discorda, konwersja HEIC → JPEG, obrót wg EXIF, zmniejszenie. Klipy z Pexels (opcjonalnie).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { env } from './config.js';
import { log } from './util.js';

export function isImageAttachment(a) {
  return /^image\//.test(a.content_type ?? '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(a.filename ?? '');
}

export async function normalizePhoto(buffer, outFile) {
  let input = buffer;
  const head = buffer.subarray(4, 12).toString('latin1');
  if (/ftyp(heic|heix|hevc|mif1|msf1)/.test(head)) {
    input = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.92 }));
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp(input).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true }).toFile(outFile);
  return outFile;
}

export async function ingestAttachments(attachments, dir, max) {
  const files = [];
  for (const a of attachments.filter(isImageAttachment).slice(0, max)) {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`Nie mogę pobrać zdjęcia ${a.filename}: ${res.status}`);
    const out = path.join(dir, `p${files.length}.jpg`);
    await normalizePhoto(Buffer.from(await res.arrayBuffer()), out);
    files.push(out);
  }
  return files;
}

// Darmowe klipy (licencja Pexels pozwala na użycie komercyjne bez podawania autora).
export async function fetchStockClips(queries, dir) {
  if (!env.PEXELS_API_KEY) return [];
  const clips = [];
  for (const query of queries) {
    try {
      const res = await fetch(`https://api.pexels.com/videos/search?${new URLSearchParams({ query, orientation: 'portrait', size: 'medium', per_page: '8' })}`, {
        headers: { Authorization: env.PEXELS_API_KEY },
      });
      const data = await res.json();
      const video = (data.videos ?? []).find((v) => v.duration >= 4 && v.duration <= 40);
      const file = video?.video_files
        .filter((f) => f.height >= 1280 && f.height <= 2400 && f.file_type === 'video/mp4')
        .sort((a, b) => a.height - b.height)[0];
      if (!file) continue;
      const out = path.join(dir, `clip${clips.length}.mp4`);
      const v = await fetch(file.link);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(out, Buffer.from(await v.arrayBuffer()));
      clips.push({ file: out, query });
    } catch (e) {
      log('Pexels', query, e.message);
    }
  }
  return clips;
}
