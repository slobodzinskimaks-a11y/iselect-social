// Slajd karuzeli 1080×1350 oraz relacja 1080×1920.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background, Bullet, Glass, MUTED, parseBullet, Pill, THEMES, Title } from './ui.jsx';

const PAD = 72;

function Header({ tag, index, total }) {
  return (
    <div style={{ position: 'absolute', top: 60, left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Pill text={tag} />
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, color: MUTED }}>
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>
    </div>
  );
}

function Footer({ index, total, theme }) {
  const accent = THEMES[theme].accent;
  const last = index === total - 1;
  return (
    <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 60 }}>
      {!last && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14, fontSize: 26, fontWeight: 800, letterSpacing: 5, color: MUTED, marginBottom: 30 }}>
          PRZESUŃ
          <svg width="48" height="26" viewBox="0 0 48 26"><path d="M2 13h40M30 2l12 11-12 11" stroke={accent} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i === index ? accent : 'rgba(244,241,234,0.25)' }} />
        ))}
      </div>
    </div>
  );
}

function Contact({ brand, theme, size = 34 }) {
  const accent = THEMES[theme].accent;
  const rows = [
    `@${brand.ig}`,
    `${brand.city} · ${brand.delivery.join(' · ')}`,
    ...(brand.tradeIn ? ['Przyjmujemy telefony w rozliczeniu'] : []),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.55 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ fontSize: size, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? accent : MUTED }}>{r}</div>
      ))}
    </div>
  );
}

export function Slide({ slide, index, total, theme, photos, brand }) {
  const photo = slide.photo != null ? photos[slide.photo] : null;
  const heavy = ['bullets', 'specs', 'text', 'cta', 'price'].includes(slide.kind);
  const accent = THEMES[theme].accent;
  return (
    <Background theme={theme} photo={photo} dimTop={0.85} dimBottom={heavy ? 0.9 : 0.75}>
      {heavy && photo && <AbsoluteFill style={{ background: 'rgba(10,11,13,0.45)' }} />}
      <Header tag={slide.tag} index={index} total={total} />
      <div style={{ position: 'absolute', top: 150, left: PAD, right: PAD }}>
        <Title title={slide.title} accent={slide.accent} theme={theme} size={slide.kind === 'cover' ? (slide.title.length > 26 ? 92 : 112) : 76} />
        {slide.sub && (
          <div style={{ marginTop: 22, fontSize: slide.kind === 'cover' ? 40 : 36, fontWeight: 500, lineHeight: 1.3, color: TEXT_SOFT, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            {slide.sub}
          </div>
        )}
      </div>

      {slide.kind === 'bullets' && slide.bullets.length > 0 && (
        <Glass style={{ position: 'absolute', left: PAD, right: PAD, ...(photo ? { bottom: 190 } : { top: slide.sub ? 480 : 360 }) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {slide.bullets.map((b, i) => <Bullet key={i} text={b} theme={theme} size={(slide.bullets.length > 4 ? 36 : 42) + (photo ? 0 : 6)} />)}
          </div>
        </Glass>
      )}

      {slide.kind === 'specs' && slide.specs.length > 0 && (
        <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 190, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          {slide.specs.map((s, i) => (
            <Glass key={i} style={{ padding: 34 }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, color: MUTED }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 48, fontWeight: 900, marginTop: 10, color: i === 0 ? accent : undefined }}>{s.value}</div>
            </Glass>
          ))}
        </div>
      )}

      {slide.kind === 'price' && (
        <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 230 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: MUTED }}>CENA</div>
          <div style={{ fontSize: 190, fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: -4 }}>{slide.specs[0]?.value || slide.bullets[0] || ''}</div>
          {slide.bullets.slice(slide.specs[0] ? 0 : 1).map((b, i) => <Bullet key={i} text={b} theme={theme} size={36} style={{ marginTop: 22 }} />)}
        </div>
      )}

      {slide.kind === 'cta' && !photo && slide.bullets.length === 0 && (
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 560, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: accent, color: '#111', fontSize: 54, fontWeight: 900, padding: '36px 72px', borderRadius: 999, letterSpacing: 2, boxShadow: '0 12px 50px rgba(0,0,0,0.45)' }}>NAPISZ NA DM</div>
        </div>
      )}

      {slide.kind === 'cta' && (
        <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 140 }}>
          {slide.bullets.map((b, i) => <Bullet key={i} text={b} theme={theme} size={38} style={{ marginBottom: 22 }} />)}
          <Glass style={{ marginTop: 20 }}><Contact brand={brand} theme={theme} /></Glass>
        </div>
      )}

      {slide.kind === 'text' && slide.bullets.length > 0 && (
        <div style={{ position: 'absolute', left: PAD, right: PAD, ...(photo ? { bottom: 190 } : { top: slide.sub ? 480 : 380 }), display: 'flex', flexDirection: 'column', gap: 26 }}>
          {slide.bullets.map((b, i) => <Bullet key={i} text={b} theme={theme} size={38} />)}
        </div>
      )}

      {slide.kind === 'cover' && slide.bullets.length > 0 && (
        <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 190, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {slide.bullets.slice(0, 3).map((b, i) => <Pill key={i} text={parseBullet(b).text.toUpperCase()} size={24} />)}
        </div>
      )}

      <Footer index={index} total={total} theme={theme} />
    </Background>
  );
}

const TEXT_SOFT = 'rgba(244,241,234,0.92)';

export function Story({ story, theme, photos, brand }) {
  const photo = story.photo != null ? photos[story.photo] : null;
  const accent = THEMES[theme].accent;
  return (
    <Background theme={theme} photo={photo} dimTop={0.8} dimBottom={0.85}>
      <div style={{ position: 'absolute', top: 250, left: PAD, right: PAD }}>
        <Pill text={story.tag} size={30} />
        <Title title={story.title} accent={story.accent} theme={theme} size={story.title.length > 28 ? 100 : 120} style={{ marginTop: 34 }} />
        {story.sub && <div style={{ marginTop: 28, fontSize: 46, fontWeight: 500, lineHeight: 1.3, color: TEXT_SOFT, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{story.sub}</div>}
      </div>
      <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <div style={{ background: accent, color: '#111', fontSize: 46, fontWeight: 900, padding: '30px 60px', borderRadius: 999, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>{story.cta}</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: MUTED }}>@{brand.ig} · {brand.city}</div>
      </div>
    </Background>
  );
}
