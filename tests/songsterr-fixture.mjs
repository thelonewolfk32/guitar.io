export function songsterrFixture(){
  return {url:'https://www.songsterr.com/a/wsa/sync-study-tab-s123',songId:123,revisionId:456,meta:{title:'Sync Study',artist:'Fixture'},tracks:[
    {name:'Guitar',instrumentId:30,tuning:[64,59,55,50,45,40],automations:{tempo:[{measure:0,bpm:137,type:4},{measure:2,bpm:98,type:4}]},measures:Array.from({length:4},(_,i)=>({signature:i===0?[4,4]:undefined,marker:i===0?{text:'Intro'}:i===2?{text:'Solo'}:undefined,voices:[{beats:[{type:1,notes:[{string:0,fret:i===0?0:3,tie:i===1,dead:i===3}]}]}]}))},
    {name:'Bass',instrumentId:33,tuning:[43,38,33,28],measures:Array.from({length:4},()=>({voices:[{beats:[{type:1,notes:[{string:3,fret:0}]}]}]}))},
    {name:'Drums',instrumentId:1024,measures:Array.from({length:4},()=>({voices:[{beats:[{type:1,notes:[{fret:38}]}]}]}))}
  ],videos:[{videoId:'dQw4w9WgXcQ',purpose:'full',points:[5,7,10,12]}]};
}
