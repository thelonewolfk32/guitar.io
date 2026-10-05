import type { GuitarProfile } from './types';
export function validateGuitars(value: unknown): GuitarProfile[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid guitar profiles.');
  const ids = new Set(), names = new Set();
  return value.map(g => {
    if (!g || typeof g.id !== 'string' || !g.id || g.id.length > 100 || ids.has(g.id) || typeof g.name !== 'string' || !g.name.trim() || g.name.length > 100 || names.has(g.name.trim().toLowerCase())) throw new Error('Invalid or duplicate guitar profile.');
    ids.add(g.id); names.add(g.name.trim().toLowerCase());
    if (g.artworkAssetId !== undefined && (typeof g.artworkAssetId !== 'string' || !g.artworkAssetId || g.artworkAssetId.length > 100)) throw new Error('Invalid guitar artwork.');
    for (const key of ['make', 'model', 'material', 'stringGauge', 'notes']) if (typeof g[key] !== 'string' || g[key].length > 4000) throw new Error('Invalid guitar details.');
    if (!['guitar', 'bass'].includes(g.kind) || !Number.isInteger(g.strings) || g.strings < 4 || g.strings > 8 || !Array.isArray(g.tunings) || g.tunings.length > 100) throw new Error('Invalid guitar configuration.');
    for (const t of g.tunings) if (!t || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 200 || !Array.isArray(t.pitches) || t.pitches.length !== g.strings || !t.pitches.every((p: unknown) => Number.isInteger(p) && Number(p) >= 0 && Number(p) <= 127)) throw new Error('Invalid guitar tuning.');
    const extra: Partial<GuitarProfile> = {};
    for (const key of ['stringBrand','stringModel','pickups','bridge','scaleLength'] as const) if (g[key] !== undefined) { if(typeof g[key] !== 'string' || g[key].length>200) throw new Error('Invalid guitar specification.'); extra[key]=g[key]; }
    if(g.stringGauges !== undefined) { if(!Array.isArray(g.stringGauges) || g.stringGauges.length!==g.strings || !g.stringGauges.every((v:unknown)=>typeof v==='string' && v.length<=30)) throw new Error('Invalid string gauges.'); extra.stringGauges=[...g.stringGauges]; }
    return { ...extra, id: g.id, name: g.name.trim(), make: g.make, model: g.model, material: g.material, stringGauge: g.stringGauge, notes: g.notes, kind: g.kind, strings: g.strings, tunings: g.tunings.map((t: { name: string; pitches: number[] }) => ({ name: t.name, pitches: [...t.pitches] })), ...(g.artworkAssetId ? { artworkAssetId: g.artworkAssetId } : {}) };
  });
}
