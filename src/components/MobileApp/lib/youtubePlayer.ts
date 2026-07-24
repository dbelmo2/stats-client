declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLIFrameElement,
        options: { events?: { onStateChange?: (e: { data: number }) => void } }
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YTPlayer = {
  destroy: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  getCurrentTime: () => number;
  setVolume: (v: number) => void;
};

let _ytReady = false;
const _ytQueue: (() => void)[] = [];

export function loadYTApi(cb: () => void): void {
  if (_ytReady) { cb(); return; }
  _ytQueue.push(cb);
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    _ytReady = true;
    if (prev) prev();
    _ytQueue.splice(0).forEach(fn => fn());
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}
