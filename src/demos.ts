import type { Song } from './types';
import { COLORS } from './types';

const riffs = {
  afterglow: [
    '0.6.8 2.4 0.3 2.2 0.1 2.2 0.3 2.4',
    '3.6.8 0.4 0.3 3.2 0.1 3.2 0.3 0.4',
    '5.6.8 7.5 7.4 0.3 0.2 0.3 7.4 7.5',
    '7.6.8 9.5 9.4 0.3 0.2 0.3 9.4 9.5',
    '(0.6 0.5 0.4).4 r.8 (0.6 0.5 0.4).8 (3.6 3.5 3.4).4 (5.6 5.5 5.4).4',
    '(7.6 7.5 7.4).4 (7.6 7.5 7.4).4 (5.6 5.5 5.4).4 (3.6 3.5 3.4).4',
  ],
  low: [
    '0.8.8 0.8 0.8 r 3.8 0.8 5.8 6.8',
    '0.8.8 0.8 r 0.8 3.8 5.8 3.8 r',
    '5.8.8 5.8 7.7 5.8 6.8 6.8 8.7 6.8',
    '0.8.4 r.8 0.8.8 3.8.4 1.8.4',
  ],
  paper: [
    '0.6.8 2.5 2.4 1.3 0.2 0.1 0.2 1.3',
    '0.5.8 2.4 2.3 1.2 0.1 1.2 2.3 2.4',
    '3.5.8 2.4 0.3 1.2 0.1 1.2 0.3 2.4',
    '3.6.8 2.5 0.4 0.3 0.2 3.1 0.2 0.3',
  ],
};

export function demoSources() {
  return [
    { title: 'Afterglow', tuning: 'Drop D', notes: 'E4 B3 G3 D3 A2 D2', bpm: 108, count: 24, riffs: riffs.afterglow, tags: ['Atmospheric', 'Melodic', 'Clean'], guitars: ['6-string electric'], sections: [['Intro', 1, 4], ['Verse', 5, 12], ['Chorus', 13, 20], ['Outro', 21, 24]] },
    { title: 'Low Orbit', tuning: 'F♯ standard · 8-string', notes: 'E4 B3 G3 D3 A2 E2 B1 F#1', bpm: 132, count: 16, riffs: riffs.low, tags: ['Heavy', 'Groove', 'Rhythm'], guitars: ['8-string electric'], sections: [['Intro', 1, 4], ['Verse', 5, 8], ['Chorus', 9, 16]] },
    { title: 'Paper Trails', tuning: 'E standard', notes: 'E4 B3 G3 D3 A2 E2', bpm: 88, count: 12, riffs: riffs.paper, tags: ['Warm', 'Fingerstyle', 'Clean'], guitars: ['6-string acoustic'], sections: [['Intro', 1, 4], ['Verse', 5, 8], ['Outro', 9, 12]] },
  ].map(d => ({
    ...d,
    source: new TextEncoder().encode(`\\title "${d.title}"\n\\artist "Guitar.io Originals"\n\\tempo ${d.bpm}\n\\instrument 27\n\\tuning ${d.notes}\n.\n` + Array.from({ length: d.count }, (_, i) => d.riffs[i % d.riffs.length]).join(' |\n')),
    sections: d.sections.map(([name, start, end], i) => ({ id: crypto.randomUUID(), name: String(name), start: Number(start), end: Number(end), color: COLORS[i], status: 'new' as const, notes: '' })),
  }));
}
