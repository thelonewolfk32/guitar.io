// Temporary testing policy; restore the commercial allowance with a matching
// backend migration when testing ends.
export const SONG_POLICY=Object.freeze({version:'testing-1000-v1',testing:true,freeSongs:1000,commercialFreeSongs:5});
/** @param {{entity:string,entityId:string}} row */
export function syncParent(row){return ['song','source'].includes(row.entity)?row.entityId:['section','annotation','recording'].includes(row.entity)?row.entityId.split(':')[0]:undefined;}
/** @template {{entity:string,entityId:string,operation:string}} T
 * @param {T[]} rows @param {string[]} existingIds @param {string[]} activeIds
 * @param {number|null} limit
 * @returns {{accepted:T[],deferred:T[],admitted:string[]}} */
export function selectSyncRows(rows,existingIds,activeIds,limit){
  const existing=new Set(existingIds),active=new Set(activeIds);let remaining=limit===null?Infinity:Math.max(0,limit-existing.size);
  const admitted=new Set();
  for(const row of rows){const id=syncParent(row);if(row.operation==='upsert'&&id&&!existing.has(id)&&!admitted.has(id)&&['song','source'].includes(row.entity)&&remaining>0){admitted.add(id);remaining--;}}
  const allActive=limit===null||existing.size+admitted.size<=limit,accepted=[],deferred=[];
  for(const row of rows){const id=syncParent(row),allowed=row.operation==='delete'||!id||admitted.has(id)||existing.has(id)&&(allActive||active.size<=Number(limit)&&active.has(id));(allowed?accepted:deferred).push(row);}
  return {accepted,deferred,admitted:[...admitted]};
}
