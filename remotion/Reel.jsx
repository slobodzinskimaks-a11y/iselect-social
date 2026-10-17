// Rolka 1080×1920, 30 kl./s. Szybkie cięcia, hook widoczny od pierwszej klatki, cena "odsłaniana" pod koniec.
// Tekst trzymamy w bezpiecznej strefie (IG zasłania dół ~330 px i prawą krawędź ~130 px).
import React from 'react';
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Bullet, Glass, MUTED, Pill, THEMES, Title } from './ui.jsx';

export const FPS = 30;
export const sceneFrames = (s) => Math.round(s.seconds * FPS);
const L = 80;
const R = 150;

function useIn(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 180 } });
}

function Rise({ delay = 0, children, style }) {
  const p = useIn(delay);
  return <div style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px)`, ...style }}>{children}</div>;
}

function SceneView({ scene, theme, photos, clips, brand, isFirst, isLast }) {
  const frame = useCurrentFrame();
  const total = sceneFrames(scene);
  const accent = THEMES[theme].accent;
  // tło: lekki "punch" na wejściu + powolny zoom
  const zoom = interpolate(frame, [0, 6, total], [isFirst ? 1.08 : 1.12, 1.06, 1.0], { extrapolateRight: 'clamp' });
  const photo = scene.photo != null ? photos[scene.photo] : null;
  const video = scene.video != null ? clips[scene.video] : null;
  const pop = isFirst ? interpolate(frame, [0, 8], [1.05, 1], { extrapolateRight: 'clamp' }) : 1;

  let body = null;
  if (scene.kind === 'hook') {
    // brak animacji wejścia – tekst jest od klatki 0 (najważniejsza sekunda rolki)
    body = (
      <div style={{ position: 'absolute', top: 300, left: L, right: R - 40, transform: `scale(${pop})`, transformOrigin: 'left top' }}>
        <Title title={scene.title} accent={scene.accent} theme={theme} size={scene.title.length > 30 ? 104 : 124} />
        {scene.sub && <div style={{ marginTop: 26, fontSize: 50, fontWeight: 600, lineHeight: 1.25, textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>{scene.sub}</div>}
      </div>
    );
  } else if (scene.kind === 'photo') {
    body = (
      <div style={{ position: 'absolute', top: 300, left: L, right: R }}>
        <Rise><Title title={scene.title} accent={scene.accent} theme={theme} size={92} /></Rise>
        {scene.sub && <Rise delay={4}><div style={{ marginTop: 22, fontSize: 46, fontWeight: 600, textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>{scene.sub}</div></Rise>}
      </div>
    );
  } else if (scene.kind === 'list') {
    body = (
      <div style={{ position: 'absolute', top: 300, left: L, right: R }}>
        <Rise><Title title={scene.title} accent={scene.accent} theme={theme} size={88} /></Rise>
        <Glass style={{ marginTop: 40 }}>
          {scene.items.map((it, i) => (
            <Rise key={i} delay={4 + i * 5}><Bullet text={it} theme={theme} size={48} style={{ marginBottom: i < scene.items.length - 1 ? 30 : 0 }} /></Rise>
          ))}
        </Glass>
      </div>
    );
  } else if (scene.kind === 'price') {
    const target = Number((scene.sub.match(/\d[\d\s]*/)?.[0] ?? '').replace(/\s/g, ''));
    const t = interpolate(frame, [4, Math.max(6, total * 0.55)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const eased = 1 - (1 - t) ** 3;
    const suffix = scene.sub.replace(/^[^\d]*\d[\d\s]*/, '').trim() || 'zł';
    const shown = target ? `${Math.round(target * eased)} ${suffix}` : scene.sub;
    body = (
      <div style={{ position: 'absolute', top: 560, left: L, right: R - 60 }}>
        <Rise><Title title={scene.title || 'Cena?'} accent={scene.accent} theme={theme} size={96} /></Rise>
        <div style={{ marginTop: 20, fontSize: 210, fontWeight: 900, color: accent, letterSpacing: -6, lineHeight: 1, textShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>{shown}</div>
      </div>
    );
  } else if (scene.kind === 'compare') {
    const card = (side, hi, delay) => (
      <Rise delay={delay} style={{ flex: 1 }}>
        <Glass style={{ padding: 36, border: hi ? `3px solid ${accent}` : undefined }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: MUTED, letterSpacing: 2 }}>{side.label.toUpperCase()}</div>
          <div style={{ fontSize: 76, fontWeight: 900, marginTop: 10, color: hi ? accent : undefined }}>{side.value}</div>
        </Glass>
      </Rise>
    );
    body = (
      <div style={{ position: 'absolute', top: 300, left: L, right: R - 70 }}>
        <Rise><Title title={scene.title} accent={scene.accent} theme={theme} size={88} /></Rise>
        <div style={{ display: 'flex', gap: 24, marginTop: 50 }}>
          {card(scene.left, false, 5)}
          {card(scene.right, true, 11)}
        </div>
      </div>
    );
  } else if (scene.kind === 'progress') {
    const steps = scene.items.map((s) => {
      const [p, label] = s.split('|');
      return { pct: Math.min(100, Number(p.replace(/[^\d]/g, '')) || 0), label: (label ?? p).trim() };
    });
    const per = total / Math.max(1, steps.length);
    const k = Math.min(steps.length - 1, Math.floor(frame / per));
    const prev = k > 0 ? steps[k - 1].pct : 0;
    const pct = interpolate(frame - k * per, [0, per * 0.6], [prev, steps[k]?.pct ?? 0], { extrapolateRight: 'clamp' });
    body = (
      <div style={{ position: 'absolute', top: 640, left: L, right: R - 40 }}>
        <Title title={scene.title} accent={scene.accent} theme={theme} size={84} />
        <div style={{ marginTop: 50, height: 46, borderRadius: 23, background: 'rgba(244,241,234,0.18)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 23 }} />
        </div>
        <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', fontSize: 52, fontWeight: 900 }}>
          <span>{steps[k]?.label}</span><span style={{ color: accent }}>{Math.round(pct)}%</span>
        </div>
      </div>
    );
  } else if (scene.kind === 'cta') {
    body = (
      <div style={{ position: 'absolute', top: 520, left: L, right: R - 40 }}>
        <Rise><Title title={scene.title} accent={scene.accent} theme={theme} size={104} /></Rise>
        {scene.sub && <Rise delay={4}><div style={{ marginTop: 28, fontSize: 48, fontWeight: 600, lineHeight: 1.25 }}>{scene.sub}</div></Rise>}
        <Rise delay={9}>
          <div style={{ marginTop: 50, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start' }}>
            <Pill text={`@${brand.ig}`} size={34} />
            <div style={{ fontSize: 36, fontWeight: 700, color: MUTED }}>{brand.city} · {brand.delivery.join(' · ')}</div>
          </div>
        </Rise>
      </div>
    );
  }

  const heavy = ['list', 'price', 'compare', 'progress', 'cta'].includes(scene.kind);
  return (
    <Background theme={theme} photo={photo} video={video} zoom={zoom} dimTop={0.8} dimBottom={heavy ? 0.9 : 0.65}>
      {heavy && (photo || video) && <AbsoluteFill style={{ background: 'rgba(10,11,13,0.42)' }} />}
      {body}
    </Background>
  );
}

export function Reel({ spec, theme, photos, clips, brand }) {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {spec.scenes.map((s, i) => {
        const d = sceneFrames(s);
        const el = (
          <Sequence key={i} from={from} durationInFrames={d}>
            <SceneView scene={s} theme={theme} photos={photos} clips={clips} brand={brand} isFirst={i === 0} isLast={i === spec.scenes.length - 1} />
          </Sequence>
        );
        from += d;
        return el;
      })}
    </AbsoluteFill>
  );
}

// Okładka rolki: tytuł w środkowej części (siatka profilu przycina do 3:4).
export function ReelCover({ spec, theme, photos }) {
  const c = spec.cover;
  return (
    <Background theme={theme} photo={c.photo != null ? photos[c.photo] : null} dimTop={0.5} dimBottom={0.6}>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 25%, rgba(10,11,13,0.55) 45%, rgba(10,11,13,0.55) 62%, transparent 80%)' }} />
      <div style={{ position: 'absolute', top: 760, left: 80, right: 80, textAlign: 'center' }}>
        <Title title={c.title} accent={c.accent} theme={theme} size={c.title.length > 28 ? 100 : 120} />
      </div>
    </Background>
  );
}
