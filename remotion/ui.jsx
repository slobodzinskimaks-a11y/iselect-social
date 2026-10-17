// Wspólne elementy wyglądu – odwzorowanie stylu @iselect_hub (grafit, ciepła biel, pomarańczowy akcent).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'], subsets: ['latin', 'latin-ext'] });
export const FONT = fontFamily;

export const THEMES = {
  graphite: { bg1: '#0d0e10', bg2: '#33353a', accent: '#F5A95B', tint: 'rgba(12,13,15,' },
  red: { bg1: '#140c0c', bg2: '#57302d', accent: '#FF7A66', tint: 'rgba(22,12,12,' },
  green: { bg1: '#0b120f', bg2: '#25392f', accent: '#6EE7A8', tint: 'rgba(10,18,14,' },
};
export const TEXT = '#F4F1EA';
export const MUTED = 'rgba(244,241,234,0.78)';

export function Background({ theme, photo, video, zoom = 1, shiftY = 0, dimTop = 0.78, dimBottom = 0.7, children }) {
  const t = THEMES[theme] ?? THEMES.graphite;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 70% 55%, ${t.bg2} 0%, ${t.bg1} 70%)`, fontFamily: FONT, color: TEXT }}>
      {video != null ? (
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateY(${shiftY}px)` }}>
          <OffthreadVideo src={staticFile(video)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : photo ? (
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateY(${shiftY}px)` }}>
          <Img src={staticFile(photo)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(60% 40% at 50% 60%, rgba(255,255,255,0.10), transparent 70%)` }} />
      )}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${t.tint}${dimTop}) 0%, ${t.tint}0.15) 38%, ${t.tint}0.1) 62%, ${t.tint}${dimBottom}) 100%)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

// Tytuł z wyróżnionym słowem (accent musi wystąpić w tytule).
export function Title({ title, accent, theme, size = 100, style }) {
  const color = (THEMES[theme] ?? THEMES.graphite).accent;
  let body = title;
  if (accent) {
    const i = title.toLowerCase().indexOf(accent.toLowerCase());
    if (i >= 0) {
      body = (
        <>
          {title.slice(0, i)}
          <span style={{ color }}>{title.slice(i, i + accent.length)}</span>
          {title.slice(i + accent.length)}
        </>
      );
    }
  }
  return (
    <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.04, letterSpacing: -1.5, textShadow: '0 4px 24px rgba(0,0,0,0.45)', ...style }}>
      {body}
    </div>
  );
}

export function Pill({ text, size = 26, style }) {
  if (!text) return null;
  return (
    <div style={{
      display: 'inline-block', padding: `${size * 0.55}px ${size * 0.95}px`, borderRadius: 999,
      border: '2px solid rgba(244,241,234,0.28)', background: 'rgba(0,0,0,0.38)',
      fontSize: size, fontWeight: 800, letterSpacing: size * 0.16, ...style,
    }}>
      {text}
    </div>
  );
}

function Icon({ type, color, size }) {
  if (type === 'plus') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill={color} />
        <path d="M6.5 12.5l3.5 3.5 7.5-8" stroke="#111" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
  }
  if (type === 'minus') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF7A66" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="#111" strokeWidth="2.6" strokeLinecap="round" /></svg>
    );
  }
  return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill={color} /></svg>;
}

export function parseBullet(text) {
  const m = text.match(/^\s*([+-]|\d+[.)])\s*(.*)$/);
  if (!m) return { type: 'dot', text };
  if (m[1] === '+') return { type: 'plus', text: m[2] };
  if (m[1] === '-') return { type: 'minus', text: m[2] };
  return { type: 'num', num: m[1].replace(/[.)]/, ''), text: m[2] };
}

export function Bullet({ text, theme, size = 44, style }) {
  const color = (THEMES[theme] ?? THEMES.graphite).accent;
  const b = parseBullet(text);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: size * 0.45, fontSize: size, fontWeight: 600, lineHeight: 1.2, ...style }}>
      <div style={{ flex: 'none', marginTop: size * 0.08 }}>
        {b.type === 'num' ? (
          <div style={{ width: size * 1.05, height: size * 1.05, borderRadius: 999, background: color, color: '#111', fontWeight: 900, fontSize: size * 0.62, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{b.num}</div>
        ) : (
          <Icon type={b.type} color={color} size={size * 1.05} />
        )}
      </div>
      <div>{b.text}</div>
    </div>
  );
}

export function Glass({ children, style }) {
  return (
    <div style={{ background: 'rgba(14,15,17,0.62)', border: '2px solid rgba(244,241,234,0.12)', borderRadius: 36, padding: 44, backdropFilter: 'blur(14px)', ...style }}>
      {children}
    </div>
  );
}
