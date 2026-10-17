export type Organisation={id:string;name:string;seatLimit:number};
export type Membership={organisationId:string;userId:string;role:'owner'|'teacher'|'student'};
export type LearningAssignment={id:string;organisationId:string;teacherId:string;studentId:string;songId:string;goal:{sectionIds?:string[];targetTempo?:number;dueAt?:string}};
export type ProgressPermission={assignmentId:string;studentId:string;teacherId:string;consentedAt?:string;revokedAt?:string};
export type PracticeEvent={id:string;version:1;songId:string;kind:'session'|'progress';data:{seconds?:number;trackIndex?:number;bar?:number;percent?:number;at:string}};
/** Measures actual playback intervals, including pauses, rather than screen time. */
export class PracticeTimer {
 private started?:number;
 constructor(private emit:(seconds:number)=>void,private now=()=>performance.now()){}
 setPlaying(playing:boolean){if(playing&&this.started===undefined)this.started=this.now();if(!playing)this.checkpoint(false);}
 checkpoint(continuePlaying=true){if(this.started===undefined)return;const now=this.now(),seconds=Math.max(0,(now-this.started)/1000);this.started=continuePlaying?now:undefined;if(seconds>0)this.emit(seconds);}
}
