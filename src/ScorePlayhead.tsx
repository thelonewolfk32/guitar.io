import { useEffect, useRef } from 'react';
import type { AlphaTabApi, synth } from '@coderline/alphatab';

/** Separate overlay above selection tints. Note highlighting remains alphaTab's own. */
export default function ScorePlayhead({ api, trackIndex, rendering, external }: { api: AlphaTabApi | null; trackIndex: number; rendering: boolean; external: boolean }) {
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!api || rendering) return;
    let frame = 0, tick = api.tickPosition, tempo = 120, updated = performance.now(), playing = false;
    const position = (e: synth.PositionChangedEventArgs) => { tick = e.currentTick; tempo = e.modifiedTempo; updated = performance.now(); };
    const state = (e: synth.PlayerStateChangedEventArgs) => { playing = e.state === window.alphaTab.synth.PlayerState.Playing; updated = performance.now(); tick = api.tickPosition; };
    api.playerPositionChanged.on(position); api.playerStateChanged.on(state);
    const draw = () => {
      const element = line.current;
      if (element && api.tickCache && api.boundsLookup) {
        // Smooth short intervals between synth callbacks; recordings report their actual clock every 50 ms.
        const estimate = tick + (playing && !external ? Math.min(100, performance.now() - updated) * tempo * 960 / 60000 : 0);
        const lookup = api.tickCache.findBeat(new Set([trackIndex]), estimate);
        const bar = lookup?.masterBar ?? api.tickCache.masterBars.find(b => estimate >= b.start && estimate < b.end);
        const bounds = bar && api.boundsLookup.findMasterBarByIndex(bar.masterBar.index)?.lineAlignedBounds;
        if (bar && bounds) {
          let x = bounds.x + bounds.w * Math.max(0, Math.min(1, (estimate - bar.start) / Math.max(1, bar.end - bar.start)));
          const beat = lookup && api.boundsLookup.findBeat(lookup.beat);
          if (lookup && beat) {
            const next = lookup.nextBeat && lookup.nextBeat.masterBar === bar ? api.boundsLookup.findBeat(lookup.nextBeat.beat) : null;
            const endX = next?.onNotesX ?? bounds.x + bounds.w;
            const fraction = Math.max(0, Math.min(1, (estimate - lookup.start) / Math.max(1, lookup.end - lookup.start)));
            x = beat.onNotesX + (endX - beat.onNotesX) * fraction;
          }
          element.style.display = 'block'; element.style.transform = `translate(${x}px, ${bounds.y - 7}px)`; element.style.height = `${Math.max(50, bounds.h) + 14}px`;
        } else element.style.display = 'none';
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(frame); api.playerPositionChanged.off(position); api.playerStateChanged.off(state); };
  }, [api, trackIndex, rendering, external]);
  return <div className="score-playhead" ref={line} aria-hidden="true" style={{ display: 'none' }} />;
}
