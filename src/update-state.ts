export type UpdateAvailability={reason:string;canForce:boolean};
export function updateAvailability(s:{stopping:boolean;booting:boolean;busy:boolean;saving:boolean;player:boolean;editor:boolean;syncBusy:boolean}):UpdateAvailability{
 if(s.stopping)return {reason:'An update is already preparing.',canForce:false};
 if(s.booting)return {reason:'The library is still loading.',canForce:false};
 if(s.busy||s.saving)return {reason:'An import or save is still finishing. Try again shortly.',canForce:false};
 if(s.player)return {reason:'Close the song player before installing.',canForce:true};
 if(s.editor)return {reason:'Close the open editor before installing.',canForce:true};
 if(s.syncBusy)return {reason:'Device sync is still finishing.',canForce:true};
 return {reason:'',canForce:true};
}
