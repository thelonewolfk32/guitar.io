import type { Section } from './types';

export const SECTION_NAMES = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Breakdown', 'Interlude', 'Instrumental', 'Outro'];

/** Preserve imported/custom names; standard names number only when repeated. */
export function sectionBaseName(name: string): string | undefined {
  if(typeof name!=='string')return undefined;
  const base = name.trim().replace(/(?:\s+\d+|\s*\(\d+\))+$/g, '').replace(/^pre[ -]?chorus$/i, 'Pre-chorus');
  return SECTION_NAMES.find(value => value.toLowerCase() === base.toLowerCase());
}

export function normalizeSectionNames(sections: Section[]): Section[] {
  const sorted = [...sections].sort((a, b) => a.start - b.start);
  const counts = new Map<string, number>(), indexes = new Map<string, number>();
  for (const section of sorted) { const base = sectionBaseName(section.name); if (base) counts.set(base, (counts.get(base) || 0) + 1); }
  return sorted.map(section => {
    const base = sectionBaseName(section.name);
    if (!base) return section;
    const index = (indexes.get(base) || 0) + 1; indexes.set(base, index);
    const name = (counts.get(base) || 0) > 1 ? `${base} ${index}` : base;
    return name === section.name ? section : { ...section, name };
  });
}
