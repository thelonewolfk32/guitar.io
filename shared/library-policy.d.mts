export const SONG_POLICY:Readonly<{version:'testing-1000-v1';testing:true;freeSongs:1000;commercialFreeSongs:5}>;
export function syncParent(row:{entity:string;entityId:string}):string|undefined;
export function selectSyncRows<T extends {entity:string;entityId:string;operation:string}>(rows:T[],existingIds:string[],activeIds:string[],limit:number|null):{accepted:T[];deferred:T[];admitted:string[]};
