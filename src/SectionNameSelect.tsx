import { SECTION_NAMES, sectionBaseName } from './section-names';

export default function SectionNameSelect({ value, onChange, label = 'Section name', disabled = false }: { value: string; onChange: (value: string) => void; label?: string; disabled?: boolean }) {
  const base = sectionBaseName(value);
  return <select aria-label={label} value={base || value} disabled={disabled} onChange={e => onChange(e.target.value)}>
    {!base && value && <option value={value}>{value}</option>}
    {!value && <option value="" disabled>Section</option>}
    {SECTION_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
  </select>;
}
