// Only a selected YouTube embed receives this desktop playback control.
// No web security flags, downloads, account access or arbitrary renderer code.
function youtubeFrame(contents, videoId) {
  if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId)) throw new Error('Invalid video.');
  return contents.mainFrame.framesInSubtree.find(frame => {
    try { const url = new URL(frame.url); return url.protocol === 'https:' && ['www.youtube.com','www.youtube-nocookie.com'].includes(url.hostname) && url.pathname === '/embed/' + videoId; }
    catch { return false; }
  });
}
function rateScript(videoId, rate, request=0) {
  if (typeof videoId !== 'string' || !/^[\w-]{11}$/.test(videoId) || !Number.isFinite(rate) || rate < .25 || rate > 2 || !Number.isSafeInteger(request) || request<0) throw new Error('Choose a speed between 25% and 200%.');
  rate=Math.round(rate*20+1e-9)/20;
  return `(() => {
    const video = document.querySelector('video');
    if (!video) return null;
    const state=video.__guitarioControl ||= {request:0,rate:1,userAction:-Infinity,corrections:[],disabled:false};
    if (${request} < state.request) return video.playbackRate;
    if (state.disabled) return null;
    state.request=${request};state.rate=${rate};state.userAction=-Infinity;
    const report = () => {
      const user=performance.now()-state.userAction<1500;
      if(user){state.rate=video.playbackRate;state.userAction=-Infinity;}
      else if(!state.disabled && Math.abs(video.playbackRate-state.rate)>.000001){
        state.corrections=state.corrections.filter(time=>performance.now()-time<1000);
        state.corrections.push(performance.now());
        if(state.corrections.length>4)state.disabled=true;
        else video.playbackRate=state.rate;
      }
      parent.postMessage({type:'guitario-youtube-rate',videoId:${JSON.stringify(videoId)},rate:video.playbackRate,request:state.request,requested:!user,failed:state.disabled}, '*');
    };
    if (!video.__guitarioRateListener) {
      video.addEventListener('ratechange', report);
      video.addEventListener('loadedmetadata', report);
      video.addEventListener('playing', report);
      document.addEventListener('pointerdown', event=>{if(event.isTrusted && event.target.closest?.('.ytp-settings-menu'))state.userAction=performance.now();},true);
      document.addEventListener('keydown', event=>{if(event.isTrusted && event.shiftKey && ['Comma','Period'].includes(event.code))state.userAction=performance.now();},true);
      video.__guitarioRateListener = true;
    }
    const player = document.getElementById('movie_player');
    if (typeof player?.setPlaybackRate === 'function') player.setPlaybackRate(${rate});
    // The native video supports fine rates even when the public iframe API rounds them.
    video.preservesPitch = true;
    video.playbackRate = ${rate};
    report();
    return video.playbackRate;
  })()`;
}
module.exports = {youtubeFrame, rateScript};
