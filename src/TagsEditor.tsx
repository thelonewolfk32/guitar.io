import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { parseTags } from './domain.mjs';
export default function TagsEditor({value,onChange}:{value:string[];onChange:(tags:string[])=>void}) {
  const [adding,setAdding]=useState(false),[text,setText]=useState('');
  function add(){const tags=parseTags([...value,text].join(','));onChange(tags);setText('');setAdding(false);}
  return <div className="tag-editor"><span>Tags</span><div>{value.map(tag=><span className="tag-chip" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag} tag`} onClick={()=>onChange(value.filter(t=>t!==tag))}><X size={12}/></button></span>)}<button className="icon-button" type="button" aria-label="Add tag" onClick={()=>setAdding(v=>!v)}><Plus size={16}/></button>{adding && <input autoFocus aria-label="New tag" placeholder="Heavy, Chill, Melodic" maxLength={1000} value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{if(text.trim())add();else setAdding(false);}} onKeyDown={e=>{if(e.key==='Enter' || e.key===','){e.preventDefault();add();}if(e.key==='Escape'){e.stopPropagation();setAdding(false);}}}/>}</div></div>;
}
