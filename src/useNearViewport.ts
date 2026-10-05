import { useEffect, useState, type RefObject } from 'react';
export function useNearViewport(ref: RefObject<Element | null>) {
  const [near,setNear]=useState(typeof IntersectionObserver==='undefined');
  useEffect(()=>{
    if(typeof IntersectionObserver==='undefined' || !ref.current)return;
    const observer=new IntersectionObserver(entries=>setNear(entries.some(e=>e.isIntersecting)),{rootMargin:'240px'});
    observer.observe(ref.current);return ()=>observer.disconnect();
  },[ref]);
  return near;
}
