// Styl „redakcyjny” do treści ogólnych: zdjęcie na całą grafikę, magazynowa typografia, kategoria materiału.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { FONT, MUTED, parseBullet, TEXT } from './ui.jsx';

export const ED = { bg: '#0b0c0f', panel: '#121419', accent: '#F5A95B', line: 'rgba(244,241,234,0.16)' };
const PAD = 76;

export function Photo({ src, style }) {
  if (!src) return <AbsoluteFill style={{ background: `radial-gradient(90% 60% at 70% 30%, #2a2f3a 0%, ${ED.bg} 70%)`, ...style }} />;
  return <Img src={staticFile(src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }} />;
}

// Tytuł z wyróżnieniem: akcent w kolorze albo w „ramce” (styl napisów z rolek).
export function EdTitle({ title: rawTitle, accent: rawAccent, size, box = false, align = 'left', style }) {
  // liczby typu „10 000 zł” nie mogą się łamać między liniami
  const nb = (s) => (s ?? '').replace(/(\d) (?=\d{3}\b)/g, '$1 ').replace(/(\d) (zł|%|GB|TB|Hz)/g, '$1 $2');
  const title = nb(rawTitle);
  const accent = nb(rawAccent);
  let body = title;
  if (accent) {
    const i = title.toLowerCase().indexOf(accent.toLowerCase());
    if (i >= 0) {
      const hl = box
        ? { background: ED.accent, color: '#111', padding: '0 0.18em', borderRadius: '0.14em', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', whiteSpace: accent.length <= 16 ? 'nowrap' : 'normal' }
        : { color: ED.accent, whiteSpace: accent.length <= 16 ? 'nowrap' : 'normal' };
      body = <>{title.slice(0, i)}<span style={hl}>{title.slice(i, i + accent.length)}</span>{title.slice(i + accent.length)}</>;
    }
  }
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.06, letterSpacing: -size * 0.02, color: TEXT, textAlign: align, textShadow: box ? '0 6px 30px rgba(0,0,0,0.55)' : '0 4px 24px rgba(0,0,0,0.4)', ...style }}>
      {body}
    </div>
  );
}

function Label({ text }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 25, fontWeight: 800, letterSpacing: 5, color: TEXT }}>
      <div style={{ width: 12, height: 12, borderRadius: 6, background: ED.accent }} />{text}
    </div>
  );
}

function Wordmark({ size = 30 }) {
  return <div style={{ fontSize: size, fontWeight: 900, letterSpacing: -0.5, color: TEXT }}>i<span style={{ color: ED.accent }}>Select</span></div>;
}

function Rows({ items, size = 38 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((t, i) => {
        const b = parseBullet(t);
        const mark = b.type === 'num' ? b.num.padStart(2, '0') : b.type === 'minus' ? '✕' : b.type === 'plus' ? '✓' : String(i + 1).padStart(2, '0');
        return (
          <div key={i} style={{ display: 'flex', gap: 26, alignItems: 'baseline', padding: `${size * 0.55}px 0`, borderTop: i ? `2px solid ${ED.line}` : 'none' }}>
            <div style={{ flex: 'none', width: size * 1.6, fontSize: size * 0.8, fontWeight: 900, color: b.type === 'minus' ? '#FF7A66' : ED.accent }}>{mark}</div>
            <div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.25, color: TEXT }}>{b.text}</div>
          </div>
        );
      })}
    </div>
  );
}

export function EditorialSlide({ slide, index, total, photos, brand }) {
  const photo = slide.photo != null ? photos[slide.photo] : null;
  const cover = slide.kind === 'cover';
  const cta = slide.kind === 'cta';
  const footer = (
    <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 54, display: 'flex', alignItems: 'center', gap: 24, fontSize: 24, fontWeight: 700, color: MUTED }}>
      <div>@{brand.ig}</div>
      <div style={{ flex: 1, height: 3, background: ED.line, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((index + 1) / total) * 100}%`, background: ED.accent }} />
      </div>
      <div>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}{index < total - 1 ? '  →' : ''}</div>
    </div>
  );
  const header = (
    <div style={{ position: 'absolute', top: 64, left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Label text={slide.tag} />
      <Wordmark />
    </div>
  );

  if (cover || cta) {
    return (
      <AbsoluteFill style={{ background: ED.bg, fontFamily: FONT, color: TEXT }}>
        <Photo src={photo} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,9,12,0.55) 0%, rgba(8,9,12,0.05) 28%, rgba(8,9,12,0.25) 50%, rgba(8,9,12,${cta ? 0.94 : 0.9}) 78%, rgba(8,9,12,0.97) 100%)` }} />
        {header}
        <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: cta ? 330 : 150 }}>
          <div style={{ width: 90, height: 7, background: ED.accent, borderRadius: 4, marginBottom: 34 }} />
          <EdTitle title={slide.title} accent={slide.accent} size={slide.title.length > 34 ? 84 : slide.title.length > 20 ? 98 : 116} />
          {slide.sub && <div style={{ marginTop: 26, fontSize: 38, fontWeight: 500, lineHeight: 1.32, color: 'rgba(244,241,234,0.88)' }}>{slide.sub}</div>}
        </div>
        {cta && (
          <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 130 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {['Napisz na DM', 'Zadzwoń', 'OLX'].map((t, i) => (
                <div key={t} style={{ padding: '22px 34px', borderRadius: 999, fontSize: 30, fontWeight: 800, background: i === 0 ? ED.accent : 'transparent', color: i === 0 ? '#111' : TEXT, border: i === 0 ? 'none' : `2px solid ${ED.line}` }}>{t}</div>
              ))}
            </div>
            <div style={{ marginTop: 26, fontSize: 26, fontWeight: 600, color: MUTED }}>{brand.city} · {brand.delivery.join(' · ')}{brand.tradeIn ? ' · skup w rozliczeniu' : ''}</div>
          </div>
        )}
        {footer}
      </AbsoluteFill>
    );
  }

  // slajd z treścią: zdjęcie u góry przechodzi w ciemny panel z tekstem
  const photoH = slide.bullets.length > 3 || slide.specs.length > 2 ? 470 : 600;
  return (
    <AbsoluteFill style={{ background: ED.bg, fontFamily: FONT, color: TEXT }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: photoH + 160, overflow: 'hidden' }}>
        <Photo src={photo} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,9,12,0.5) 0%, rgba(8,9,12,0.0) 30%, rgba(11,12,15,0.6) 72%, ${ED.bg} 100%)` }} />
      </div>
      {header}
      <div style={{ position: 'absolute', left: PAD, right: PAD, top: photoH - 30 }}>
        <EdTitle title={slide.title} accent={slide.accent} size={slide.title.length > 40 ? 58 : 68} />
        {slide.sub && <div style={{ marginTop: 18, fontSize: 32, fontWeight: 500, lineHeight: 1.35, color: 'rgba(244,241,234,0.85)' }}>{slide.sub}</div>}
        {slide.kind === 'specs' || slide.kind === 'price' ? (
          <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: slide.specs.length === 1 ? '1fr' : '1fr 1fr', gap: 18 }}>
            {slide.specs.map((s, i) => (
              <div key={i} style={{ border: `2px solid ${ED.line}`, borderRadius: 26, padding: '26px 30px' }}>
                <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: 4, color: MUTED }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: slide.specs.length === 1 ? 110 : 56, fontWeight: 900, marginTop: 6, color: i === 0 ? ED.accent : TEXT }}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {slide.bullets.length > 0 && <div style={{ marginTop: 22 }}><Rows items={slide.bullets} size={slide.bullets.length > 4 ? 33 : 38} /></div>}
      </div>
      {footer}
    </AbsoluteFill>
  );
}

export function EditorialStory({ story, photos, brand }) {
  const photo = story.photo != null ? photos[story.photo] : null;
  return (
    <AbsoluteFill style={{ background: ED.bg, fontFamily: FONT, color: TEXT }}>
      <Photo src={photo} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,9,12,0.6) 0%, rgba(8,9,12,0.05) 25%, rgba(8,9,12,0.2) 45%, rgba(8,9,12,0.92) 75%, rgba(8,9,12,0.97) 100%)' }} />
      <div style={{ position: 'absolute', top: 230, left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between' }}>
        <Label text={story.tag} />
        <Wordmark size={34} />
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 520 }}>
        <div style={{ width: 90, height: 7, background: ED.accent, borderRadius: 4, marginBottom: 34 }} />
        <EdTitle title={story.title} accent={story.accent} size={story.title.length > 30 ? 96 : 116} />
        {story.sub && <div style={{ marginTop: 26, fontSize: 44, fontWeight: 500, lineHeight: 1.3, color: 'rgba(244,241,234,0.88)' }}>{story.sub}</div>}
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 330, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ background: ED.accent, color: '#111', fontSize: 40, fontWeight: 900, padding: '26px 52px', borderRadius: 999 }}>{story.cta}</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: MUTED }}>@{brand.ig}</div>
      </div>
    </AbsoluteFill>
  );
}
