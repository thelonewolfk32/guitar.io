import type { LibrarySong as Song } from './types';
import { songProgress } from './library-model';

const descending = new Set(['progress','difficulty','added','explore','mastered','learning']);
export function sortSpec(value: string) {
  const [field,suffix] = value.split(':');
  return {field,direction:suffix === 'asc' || suffix === 'desc' ? suffix : descending.has(field) ? 'desc' : 'asc'};
}
export function nextSort(current: string, field: string) {
  const spec = sortSpec(current), direction = spec.field === field ? (spec.direction === 'asc' ? 'desc' : 'asc') : descending.has(field) ? 'desc' : 'asc';
  return `${field}:${direction}`;
}
export function compareText(a: string,b: string) { return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}); }
export function sortSongs(songs: Song[], value: string) {
  const {field,direction} = sortSpec(value), sign = direction === 'desc' ? -1 : 1;
  return [...songs].sort((a,b)=>{
    let difference = 0;
    if(field==='progress') difference= songProgress(a)-songProgress(b);
    else if(field==='difficulty') difference=(a.difficulty || 0)-(b.difficulty || 0);
    else if(field==='added') return Number(a.demo)-Number(b.demo) || sign*compareText(a.createdAt,b.createdAt) || compareText(a.title,b.title);
    else if(['title','artist','album','tuning'].includes(field)) difference=compareText(String(a[field as 'title'] || ''),String(b[field as 'title'] || ''));
    return sign*difference || compareText(a.title,b.title) || compareText(a.artist,b.artist);
  });
}
export const SORT_CHOICES = [['added','Recently added'],['title:asc','Name A–Z'],['title:desc','Name Z–A'],['artist:asc','Artist A–Z'],['artist:desc','Artist Z–A'],['album:asc','Album A–Z'],['album:desc','Album Z–A'],['tuning:asc','Tuning A–Z'],['tuning:desc','Tuning Z–A'],['difficulty:desc','Hardest first'],['difficulty:asc','Easiest first'],['progress:desc','Most learnt'],['progress:asc','Least learnt']] as const;
