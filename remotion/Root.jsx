import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Slide, Story } from './Slide.jsx';
import { FPS, Reel, ReelCover, sceneFrames } from './Reel.jsx';

const brand = { ig: 'iselect_hub', city: 'Dzierżoniów', delivery: ['odbiór osobisty', 'wysyłka'], tradeIn: true };
const sampleSlide = { kind: 'cover', tag: 'NA SPRZEDAŻ', title: 'iPhone 13 Pro', accent: 'Pro', sub: 'Graphite · 128 GB', bullets: [], specs: [], photo: null };
const sampleReel = { scenes: [{ kind: 'hook', title: 'Jest jeden haczyk', accent: 'haczyk', sub: '', items: [], seconds: 2, photo: null, video: null }], cover: { title: 'Bierzesz?', accent: '', photo: null } };

function Root() {
  return (
    <>
      <Composition id="Slide" component={Slide} width={1080} height={1350} fps={FPS} durationInFrames={1}
        defaultProps={{ slide: sampleSlide, index: 0, total: 6, theme: 'graphite', photos: [], brand }} />
      <Composition id="Story" component={Story} width={1080} height={1920} fps={FPS} durationInFrames={1}
        defaultProps={{ story: { tag: 'NOWOŚĆ', title: 'iPhone 13 Pro', accent: 'Pro', sub: '', cta: 'Napisz na DM', photo: null }, theme: 'graphite', photos: [], brand }} />
      <Composition id="Reel" component={Reel} width={1080} height={1920} fps={FPS} durationInFrames={60}
        defaultProps={{ spec: sampleReel, theme: 'graphite', photos: [], clips: [], brand }}
        calculateMetadata={({ props }) => ({ durationInFrames: props.spec.scenes.reduce((a, s) => a + sceneFrames(s), 0) })} />
      <Composition id="ReelCover" component={ReelCover} width={1080} height={1920} fps={FPS} durationInFrames={1}
        defaultProps={{ spec: sampleReel, theme: 'graphite', photos: [] }} />
    </>
  );
}

registerRoot(Root);
