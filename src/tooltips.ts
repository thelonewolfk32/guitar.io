/** Supply native, accessible tooltips across every window, including dynamic menus. */
export function installTooltips(){
  const generated=new WeakMap<Element,string>();
  const selector='button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=menuitem]';
  function describe(node:Element){
    if(node.hasAttribute('title') && node.getAttribute('title')!==generated.get(node))return;
    let label=node.getAttribute('aria-label') || '';
    if(!label && (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement)){
      const control=node as HTMLInputElement;
      const parent=control.labels?.[0];
      if(parent){const copy=parent.cloneNode(true) as Element;copy.querySelectorAll('input,select,textarea,button,output').forEach(n=>n.remove());label=copy.textContent || '';}
    }
    label=(label || node.textContent || node.getAttribute('placeholder') || '').replace(/\s+/g,' ').trim();
    if(label){node.setAttribute('title',label);generated.set(node,label);}
  }
  function scan(root:Element){if(root.matches(selector))describe(root);root.querySelectorAll(selector).forEach(describe);}
  scan(document.documentElement);
  new MutationObserver(records=>{
    const roots=new Set<Element>();
    for(const record of records){if(record.type==='attributes' && record.target instanceof Element)describe(record.target);else if(record.type==='characterData'){const parent=record.target.parentElement?.closest(selector);if(parent)describe(parent);}else{if(record.target instanceof Element&&record.target.matches(selector))describe(record.target);for(const node of record.addedNodes)if(node instanceof Element)roots.add(node);}}
    roots.forEach(scan);
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-pressed','aria-expanded']});
}
