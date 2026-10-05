import type { Section, Range } from './types';
import { learnedPercent, withLearningPercent } from './library-model';
import { normalizeSectionNames, sectionBaseName } from './section-names';

/** Insert a range without discarding the progress and setup of the surrounding bars. */
export function insertSection(sections: Section[], section: Section): Section[] {
  const retained = sections.flatMap(s => {
    if (s.id === section.id) return [];
    if (s.end < section.start || s.start > section.end) return [s];
    return [
      ...(s.start < section.start ? [{...s, end: section.start - 1}] : []),
      ...(s.end > section.end ? [{...s, id: s.start < section.start ? crypto.randomUUID() : s.id, start: section.end + 1}] : []),
    ];
  });
  return normalizeSectionNames([...retained, section]);
}

export function splitSection(sections: Section[], id: string, beforeBar: number): Section[] {
  const section = sections.find(s => s.id === id);
  if (!section || !Number.isInteger(beforeBar) || beforeBar <= section.start || beforeBar > section.end) throw new Error('Split inside a section, before a bar after its first bar.');
  return normalizeSectionNames(sections.flatMap(s => s.id !== id ? [s] : [{ ...s, end: beforeBar - 1 }, { ...s, id: crypto.randomUUID(), name: sectionBaseName(s.name) || `${s.name} (2)`, start: beforeBar }]));
}

export function mergeSection(sections: Section[], id: string, direction: -1 | 1): Section[] {
  const sorted = [...sections].sort((a, b) => a.start - b.start);
  const index = sorted.findIndex(s => s.id === id);
  const from = sorted[index], into = sorted[index + direction];
  if (!from || !into || (direction === 1 ? from.end + 1 !== into.start : into.end + 1 !== from.start)) throw new Error('Only neighbouring sections without a gap can be merged.');
  const length = (s: Section) => s.end - s.start + 1;
  const percent = Math.round((learnedPercent(from) * length(from) + learnedPercent(into) * length(into)) / (length(from) + length(into)));
  const combined: Section = withLearningPercent({ ...into, start: Math.min(from.start, into.start), end: Math.max(from.end, into.end), instructionalTimestamps: combinedTimestamps([from, into]), notes: [from, into].sort((a, b) => a.start - b.start).filter(s => s.notes.trim()).map(s => `${s.name}: ${s.notes}`).join('\n\n') }, percent);
  return normalizeSectionNames(sorted.filter(s => s.id !== from.id && s.id !== into.id).concat(combined));
}

function combinedTimestamps(sections: Section[]) {
  const result: Record<string, number> = {};
  for (const section of [...sections].sort((a,b) => a.start-b.start)) for (const [id,time] of Object.entries(section.instructionalTimestamps || {})) if (!(id in result)) result[id] = time;
  return Object.keys(result).length ? result : undefined;
}

/** Merge exactly the selected bars, retaining unselected tails and legacy notes. */
export function mergeSelection(sections: Section[], range: Range): Section[] {
  const selected = sections.filter(s => s.start <= range.end && s.end >= range.start).sort((a,b) => a.start-b.start);
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 1 || range.end < range.start || selected.length < 2) throw new Error('Select bars spanning at least two sections.');
  const weighted = selected.reduce((sum,s) => sum + (Math.min(s.end,range.end)-Math.max(s.start,range.start)+1)*learnedPercent(s), 0);
  const combined = withLearningPercent({ ...selected[0], id: crypto.randomUUID(), start: range.start, end: range.end,
    instructionalTimestamps: combinedTimestamps(selected), notes: selected.filter(s=>s.notes.trim()).map(s=>`${s.name}: ${s.notes}`).join('\n\n') }, weighted/(range.end-range.start+1));
  const selectedIds = new Set(selected.map(s=>s.id));
  const retained = sections.flatMap(s => !selectedIds.has(s.id) ? [s] : [ ...(s.start < range.start ? [{ ...s, end: range.start-1 }] : []), ...(s.end > range.end ? [{ ...s, id: s.start < range.start ? crypto.randomUUID() : s.id, start: range.end+1 }] : []) ]);
  return normalizeSectionNames([...retained,combined]);
}
