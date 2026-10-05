import { AudioLines, Plus, Search, X, Folder, FolderPlus, Guitar, Pencil, Trash2, Archive, Piano, FileMusic, Music2, Play, SlidersHorizontal, Headphones, Youtube, LayoutGrid, Grid2X2, List, ArrowDown, ArrowUp, ArrowLeft } from 'lucide-react';
import { useEffect, useState, useRef, useMemo, type CSSProperties, type DragEvent } from 'react';
import type { LibrarySong as Song, Folder as FolderType, FilterTab, GuitarProfile } from './types';
import { songValues } from './domain.mjs';
import { useNearViewport } from './useNearViewport';
import { useArtworkTint } from './useArtworkTint';
import { tuningCaption } from './tuning-caption';
import { recordingsFor } from './recordings';
import { matchesGuitarTuning } from './guitar-matching';
import { tuningHasGuitar } from './guitar-assignment';
import DifficultyStars from './DifficultyStars';
import { nextSort, sortSpec, SORT_CHOICES, compareText } from './library-order';
import CollectionCard from './CollectionCard';
import RecentStories from './RecentStories';
import {SongProgressBar,MasteredStamp} from './SongProgress';
import { songProgress, collectionProgress } from './library-model';
import { useAssetUrl, GuitarAssignmentMark } from './ui';

function SongCard({ song, onOpen, onEdit, onDelete, onDifficulty }: { onDifficulty:(value:number | undefined)=>void; song: Song; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const card=useRef<HTMLElement>(null),near=useNearViewport(card);
  const artwork = useAssetUrl(near? song.artworkAssetId : undefined);
  const progress = songProgress(song), tint = useArtworkTint(artwork);
  const wasDragged = useRef(false);
  const tuning = useMemo(() => tuningCaption(song), [song]);
  const recordingKinds = 'summaryVersion' in song ? song.recordingKinds : recordingsFor(song).map(r => r.kind);
  return <article ref={card} className="song-card" draggable style={{ '--art-tint': tint } as CSSProperties} onDragStart={e => { wasDragged.current = true; e.dataTransfer.setData('application/x-guitario-song', song.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging-song'); }} onDragEnd={e => { e.currentTarget.classList.remove('dragging-song'); }} onPointerDown={() => { wasDragged.current = false; }} onClickCapture={e => { if (wasDragged.current) { e.preventDefault(); e.stopPropagation(); } }} onClick={e => { if (!(e.target as Element).closest('button,input,select,label')) onOpen(); }} aria-label={`${song.title}, drag to a collection`}>
    <button className={`card-art art-${song.title.length % 3}`} onClick={onOpen} aria-label={`Open ${song.title}`}>
      {artwork ? <img src={artwork} alt="" draggable={false} /> : <><div className="cover-orbits"><i /><i /><i /><i /></div><AudioLines size={65} strokeWidth={1} /><span className="cover-type">{song.demo ? 'GUITAR.IO ORIGINALS' : song.artist}</span></>}
      <span className="cover-open"><Play size={19} fill="currentColor" /></span>
      <MasteredStamp song={song}/>
    </button>
    <div className="card-body"><div className="card-title"><button onClick={onOpen}><h2>{song.title}</h2></button>{!song.guitars.length && <GuitarAssignmentMark name={song.title}/>}<div className="card-actions"><button className="icon-button" title="Song details" aria-label={`Edit ${song.title} details`} onClick={onEdit}><SlidersHorizontal size={15} /></button><button className="icon-button delete-song-visible" title="Delete from library" aria-label={`Delete ${song.title}`} onClick={onDelete}><Trash2 size={15} /></button></div></div>
      <p className="card-artist">{song.artist}</p><p className="card-album">{song.album || "—"}</p><div className="card-tuning"><Music2 size={12} /><span>{tuning.original}{tuning.change && <small>{tuning.change}</small>}</span></div>
      <div className="card-difficulty"><DifficultyStars label={`${song.title} difficulty`} value={song.difficulty} onChange={onDifficulty}/></div>
      <div className="card-tags">{song.guitars.slice(0, 2).map(g => <span key={g}>{g}</span>)}{song.tags.slice(0, 3).map(t => <span key={t}>{t}</span>)}</div>
      <div className="card-progress-label"><span>{progress}% learnt</span></div><SongProgressBar song={song} className="progress-rail"/>
      <div className="card-footer"><div className="song-formats"><span title="MIDI playback" aria-label="MIDI playback"><Piano size={17} /></span>{/^gp/i.test(song.format) && <span title="Guitar Pro file" aria-label="Guitar Pro file"><FileMusic size={16} /><small>GP</small></span>}{recordingKinds.includes('youtube') && <span title="YouTube attached" aria-label="YouTube attached"><Youtube size={17} /></span>}{recordingKinds.includes('audio') && <span title="Audio attached" aria-label="Audio attached"><Headphones size={16} /></span>}</div></div>
    </div>
  </article>;
}

export type LibraryFilters = { artist: string; tuning: string; guitar: string; tag: string; difficulty: string };
type Props = { onDifficulty:(id:string,value:number | undefined)=>Promise<void>; onBackups: () => void; onMoveSong: (id: string, folderId: string) => Promise<void>; guitars: GuitarProfile[]; onGuitar: (name?: string, addTuning?:boolean) => void; songs: Song[]; filtered: Song[]; folders: FolderType[]; folderId: string; setFolderId: (v: string) => void; query: string; setQuery: (v: string) => void; sort: string; setSort: (v: string) => void; onOpen: (s: Song) => void; onEdit: (s: Song) => void; onDelete: (s: Song) => void; onImport: () => void; onFolder: (f?: FolderType) => void; clearFilters: () => void; tab: FilterTab; group: string; setGroup: (name: string) => void; filters: LibraryFilters; setFilters: (filters: LibraryFilters) => void; onArtwork: (tab: FilterTab, name: string, file: File) => void };
export default function LibraryHome(p: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false), [searchOpen,setSearchOpen]=useState(false);
  const [views,setViews] = useState<Record<string,string>>(()=>{try{const saved=JSON.parse(window.localStorage.getItem('guitario-library-views') || '{}');return saved && typeof saved==='object' && !Array.isArray(saved) ? saved : {};}catch{return {};}});
  const validView = (value:unknown) => value==='compact' || value==='list' ? value : 'cards';
  const [legacyView] = useState(()=>{try{return window.localStorage.getItem('guitario-library-view');}catch{return 'cards';}});
  const view = validView(views[p.tab] ?? legacyView);
  const setView = (value:string) => setViews(old=>({...old,[p.tab]:value}));
  useEffect(()=>{try{window.localStorage.setItem('guitario-library-views',JSON.stringify(views));}catch{}},[views]);
  const [collectionSort,setCollectionSort] = useState('title');
  const [guitarTuning, setGuitarTuning] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  useEffect(() => { setGuitarTuning(null); }, [p.tab, p.group]);
  function dropProps(id: string) { return { onDragOver: (e: DragEvent) => { if (!e.dataTransfer.types.includes('application/x-guitario-song')) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget(id); }, onDragLeave: (e: DragEvent) => { if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setDropTarget(null); }, onDrop: (e: DragEvent) => { const songId = e.dataTransfer.getData('application/x-guitario-song'); if (!songId) return; e.preventDefault(); e.stopPropagation(); setDropTarget(null); void p.onMoveSong(songId, id); } }; }
  const profile = p.guitars.find(g => g.name === p.group);
  const tuningFolders = p.tab === 'Guitars' && !!p.group;
  const tuningGroups = new Map<string, Song[]>();
  if (tuningFolders) {
    for (const tuning of profile?.tunings || []) tuningGroups.set(tuning.name, []);
    for (const song of p.filtered) {
      const matches=profile?.tunings.filter(t=>matchesGuitarTuning(song,t));
      if(profile && !matches?.length)continue;
      for(const name of matches?.map(t=>t.name) || [song.tuning]) tuningGroups.set(name,[...(tuningGroups.get(name) || []),song]);
    }
  }
  const displayed = tuningFolders && guitarTuning !== null ? tuningGroups.get(guitarTuning) || [] : p.filtered;
  const browsing = p.tab !== 'All songs' && !p.group;
  const title = (tuningFolders && guitarTuning ? p.group + ' / ' + guitarTuning : p.group) || (browsing ? p.tab : p.folders.find(f => f.id === p.folderId)?.name || (p.folderId === 'unfiled' ? 'Unfiled songs' : 'Your library'));
  const groups = new Map<string, Song[]>();
  if (browsing) for (const song of (p.tab === 'Artists' ? p.songs.filter(s=>!p.query || s.artist.toLocaleLowerCase().includes(p.query.toLocaleLowerCase())) : p.filtered)) for (const name of songValues(song, p.tab)) groups.set(name, [...(groups.get(name) || []), song]);
  if (browsing && p.tab === 'Guitars') for (const guitar of p.guitars) if (guitar.name.toLowerCase() !== 'unassigned' && !groups.has(guitar.name) && (!p.query || guitar.name.toLowerCase().includes(p.query.toLowerCase()))) groups.set(guitar.name, []);
  const filterCount = Object.values(p.filters).filter(Boolean).length;
  function sortHeading(field:string,label:string,collection=false) {
    const current=collection?collectionSort:p.sort, spec=sortSpec(current), active=spec.field===field, Arrow=spec.direction==='desc'?ArrowDown:ArrowUp;
    return <button key={field} className="list-sort" aria-label={`Sort by ${label.toLowerCase()}`} aria-pressed={active} title={active?`${label}: ${spec.direction==='asc'?'ascending':'descending'}. Click to reverse.`:`Sort by ${label.toLowerCase()}`} onClick={()=>collection?setCollectionSort(nextSort(current,field)):p.setSort(nextSort(current,field))}>{label}{active && <Arrow size={12}/>}</button>;
  }
  function orderCollections(items:[string,Song[]][]) {
    const {field,direction}=sortSpec(collectionSort),sign=direction==='desc'?-1:1;
    return items.sort(([a,as],[b,bs])=>{const key=field==='learning'?'progress':field;return (['explore','progress','mastered'].includes(key)?sign*(collectionProgress(as)[key as 'explore']-collectionProgress(bs)[key as 'explore']):sign*compareText(a,b)) || compareText(a,b);});
  }
  return <main className="library-home" data-library-view={view}>
    <aside className="folder-sidebar"><div className="panel-label"><span>COLLECTIONS</span><button className="icon-button" aria-label="Create folder" onClick={() => p.onFolder()}><FolderPlus size={17} /></button></div>
      <button className={`folder-row ${!p.folderId ? 'active' : ''}`} onClick={() => p.setFolderId('')}><AudioLines size={16} /><span>All your songs</span></button>
      <button className={`folder-row ${p.folderId === 'unfiled' ? 'active' : ''} ${dropTarget === '' ? 'drop-target' : ''}`} {...dropProps('')} onClick={() => p.setFolderId('unfiled')}><Folder size={16} /><span>Unfiled</span><small>{p.songs.filter(s => !s.folderId).length}</small></button>
      <div className="folder-divider" />
      {p.folders.map(f => <div className={`folder-row-wrap ${p.folderId === f.id ? 'active' : ''} ${dropTarget === f.id ? 'drop-target' : ''}`} {...dropProps(f.id)} key={f.id}><button className="folder-row" onClick={() => p.setFolderId(f.id)}><Folder size={16} style={{ color: f.color }} /><span>{f.name}</span><small>{p.songs.filter(s => s.folderId === f.id).length}</small></button><button className="icon-button folder-edit" aria-label={`Edit folder ${f.name}`} onClick={() => p.onFolder(f)}><Pencil size={12} /></button></div>)}
      <button className="text-button new-folder" onClick={() => p.onFolder()}><Plus size={13} /> New folder</button>
      
    </aside>
    <section className="collection-main"><RecentStories songs={p.songs} onOpen={p.onOpen}/>{p.group && <button className="icon-button collection-back back-button" aria-label="Previous collection" title="Previous collection" onClick={()=>guitarTuning!==null?setGuitarTuning(null):p.setGroup('')}><ArrowLeft size={25}/></button>}<div className="collection-heading"><div><h1>{title}</h1></div><div className="guitar-heading-actions">{p.tab === 'Guitars' ? <>{p.group && <button className="icon-button" aria-label={"Edit guitar " + p.group} onClick={()=>p.onGuitar(p.group)}><Pencil size={18}/></button>}<button className="button primary" onClick={()=>p.onGuitar(p.group || undefined,!!p.group)}><Plus size={17}/>{p.group?'Add tunings':'Add guitar'}</button></> : <button className="button primary" onClick={p.onImport}><Plus size={17}/>Add songs</button>}</div></div>
      <div className="collection-controls"><div className={`search-box ${searchOpen || p.query ? 'expanded' : 'collapsed'}`}><button className="icon-button" aria-label="Search library" aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}><Search size={19}/></button>{(searchOpen || p.query) && <><input autoFocus aria-label="Search library text" value={p.query} onChange={e=>p.setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){p.setQuery('');setSearchOpen(false);}}}/><button className="icon-button" aria-label="Clear search" onClick={()=>{p.setQuery('');setSearchOpen(false);}}><X size={14}/></button></>}</div><button className={`icon-button library-filter-toggle ${filterCount ? 'is-active' : ''}`} aria-label="Filters and sort" title="Filters and sort" aria-expanded={filtersOpen} aria-controls="library-filters" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={19}/></button><div className="library-views" role="group" aria-label="Library layout">{([['cards','Large cards',LayoutGrid],['compact','Small cards',Grid2X2],['list','List view',List]] as const).map(([value,label,Icon])=><button key={value} className="icon-button" aria-label={label} title={label} aria-pressed={view===value} onClick={()=>setView(value)}><Icon size={17}/></button>)}</div></div>
      {filtersOpen && <div className="optional-filters" id="library-filters">{([['artist', 'Artists'], ['tuning', 'Tunings'], ['guitar', 'Guitars'], ['tag', 'Vibes & tags']] as const).map(([key, tab]) => <label key={key}>{tab}<select aria-label={`Filter ${tab.toLowerCase()}`} value={p.filters[key]} onChange={e => p.setFilters({ ...p.filters, [key]: e.target.value })}><option value="">Any</option>{[...new Set(p.songs.flatMap(s => songValues(s, tab)))].sort().map(value => <option key={value}>{value}</option>)}</select></label>)}<label>Difficulty<select aria-label="Filter difficulty" value={p.filters.difficulty} onChange={e=>p.setFilters({...p.filters,difficulty:e.target.value})}><option value="">Any</option><option value="unrated">Unrated</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label><label>Sort songs<select className="library-sort" aria-label="Sort library" value={p.sort} onChange={e => p.setSort(e.target.value)}>{SORT_CHOICES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="text-button" onClick={() => { p.setFilters({ artist: '', tuning: '', guitar: '', tag: '', difficulty: '' }); p.setSort('added'); }}>Reset filters & sort</button></div>}
      <div className="library-results">
      {p.songs.length === 0 && p.tab!=='Guitars' && <div className="first-run"><Guitar size={46} strokeWidth={1.2}/><h2>{p.guitars.length ? 'Add your first song' : 'Start by adding your first guitar'}</h2><button className="button primary" onClick={()=>p.guitars.length?p.onImport():p.onGuitar()}><Plus size={17}/>{p.guitars.length?'Add song':'Add guitar'}</button></div>}
      {p.songs.length > 0 && view === 'list' && (browsing || tuningFolders && guitarTuning===null ? <div className="collection-list-heading"><span>Artwork</span>{sortHeading('title','Name',true)}<div>{sortHeading('explore','To explore',true)}{sortHeading('learning','In progress',true)}{sortHeading('mastered','Mastered',true)}</div></div> : <div className="song-list-heading"><span>Artwork</span>{([['title','Name'],['artist','Artist'],['album','Album'],['tuning','Tuning'],['difficulty','Difficulty'],['progress','Progress']] as const).map(([field,label])=>sortHeading(field,label))}</div>)}
      {browsing ? <div className="collection-grid">{orderCollections([...groups]).map(([name, songs]) => <CollectionCard key={name} tab={p.tab} name={name} songs={songs} missingGuitar={p.tab==='Tunings' && !tuningHasGuitar(name,songs,p.guitars)} artworkAssetId={p.tab === 'Guitars' ? p.guitars.find(g => g.name === name)?.artworkAssetId : undefined} onEdit={p.tab === 'Guitars' ? () => p.onGuitar(name) : undefined} onOpen={() => p.setGroup(name)} onArtwork={p.tab==='Tunings'?undefined:file => p.onArtwork(p.tab, name, file)} />)}</div> : tuningFolders && guitarTuning === null ? <div className="collection-grid">{orderCollections([...tuningGroups]).map(([name, songs]) => <CollectionCard key={name} tab="Tunings" name={name} songs={songs} onOpen={() => setGuitarTuning(name)} />)}{!tuningGroups.size && <p className="guitar-tuning-empty">Add this guitar's tunings in Guitar details.</p>}</div> : <div className="song-grid">{displayed.map(s => <SongCard key={s.id} song={s} onDifficulty={value=>void p.onDifficulty(s.id,value)} onOpen={() => p.onOpen(s)} onEdit={() => p.onEdit(s)} onDelete={() => p.onDelete(s)} />)}{p.songs.length>0 && p.tab!=='Guitars' && <button className="add-song-card" onClick={p.onImport} aria-label="Add song" title="Add song"><Plus size={25}/></button>}</div>}
      </div>
      {!displayed.length && p.songs.length > 0 && !browsing && !(tuningFolders && guitarTuning === null) && <div className="collection-empty"><p>No songs match these filters.</p><button className="button secondary" onClick={p.clearFilters}>Clear filters</button></div>}
    </section>
  </main>;
}
