export type YouTubePlayer = {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number;
  getAvailablePlaybackRates?(): number[]; getPlaybackRate(): number; setPlaybackRate(rate: number): void;
  getVolume(): number; setVolume(volume: number): void; destroy(): void;
  getIframe?(): HTMLIFrameElement;
};
type YouTubeAPI = { Player: new (element: HTMLElement, options: { width: number; height: number; videoId: string; playerVars: Record<string, string | number>; events: { onReady: (e: { target: YouTubePlayer }) => void; onError: (e: { data: number }) => void; onPlaybackRateChange: (e: { data: number }) => void } }) => YouTubePlayer };
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void; } }
let loading: Promise<YouTubeAPI> | undefined;
export function loadYouTube(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => { loading = undefined; script.remove(); reject(new Error('YouTube did not load. Check your internet connection and try again.')); }, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); previous?.(); if (window.YT) resolve(window.YT); };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); loading = undefined; script.remove(); reject(new Error('Could not load YouTube. Local MP3 and synth playback still work offline.')); };
    document.head.appendChild(script);
  });
  return loading;
}
