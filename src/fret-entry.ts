export type FretEntry = { digits: string; time: number; selection: string };
export function enterFretDigit(previous: FretEntry | null, digit: string, time: number, selection: string): FretEntry {
  const combine = previous && previous.selection === selection && time - previous.time < 1000 && previous.digits.length < 2;
  return { digits: (combine ? previous.digits : '') + digit, time, selection };
}
