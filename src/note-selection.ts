import type { model } from '@coderline/alphatab';

/** Musical time first, then staff and visual string order at the same instant. */
export function compareNotes(a: model.Note, b: model.Note) {
  return a.beat.voice.bar.index - b.beat.voice.bar.index
    || a.beat.displayStart - b.beat.displayStart
    || a.beat.voice.bar.staff.index - b.beat.voice.bar.staff.index
    || (a.isStringed && b.isStringed ? b.string - a.string : b.realValue - a.realValue)
    || a.beat.voice.index - b.beat.voice.index || a.index - b.index;
}

export type SelectionRect = { x: number; y: number; width: number; height: number };
export function notesInRect<T extends SelectionRect & { key: string }>(boxes: T[], rect: SelectionRect) {
  return [...new Set(boxes.filter(b => b.x + b.width / 2 >= rect.x && b.x + b.width / 2 <= rect.x + rect.width
    && b.y + b.height / 2 >= rect.y && b.y + b.height / 2 <= rect.y + rect.height).map(b => b.key))];
}
