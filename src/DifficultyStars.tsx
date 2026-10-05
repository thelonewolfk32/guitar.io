import { Star } from 'lucide-react';

export default function DifficultyStars({ value = 0, onChange, label = 'Difficulty', clear = false }: { value?: number; onChange:(value:number | undefined)=>void; label?:string; clear?:boolean }) {
  return <div className="difficulty-field"><div className="difficulty-rating" role="radiogroup" aria-label={label} title={value ? `Difficulty: ${value} of 5` : 'Difficulty: unrated'} onKeyDown={e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    const next=e.key==='Home'?1:e.key==='End'?5:Math.max(1,Math.min(5,value+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)));
    onChange(next);e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next-1]?.focus();
  }}>{[1,2,3,4,5].map(n=><button key={n} type="button" role="radio" aria-checked={value===n} aria-label={`${n} ${n===1?'star':'stars'}`} className={n<=value?'filled':''} tabIndex={n===(value || 1)?0:-1} onClick={e=>{e.stopPropagation();onChange(n);}}><Star size={15} fill={n<=value?'currentColor':'none'}/></button>)}</div>{clear && !!value && <button type="button" className="text-button clear-difficulty" onClick={()=>onChange(undefined)}>Clear</button>}</div>;
}
