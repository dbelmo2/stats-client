import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "../ui/button";
import type { ContestClip } from "../../shared/contestSchema";
import { pauseForVideo, resumeAfterVideo } from "../../lib/dashboardAudio";
import { loadYTApi, type YTPlayer } from "../../lib/youtubePlayer";

function RangeSlider({
  value, min, max, step, className = "",
  onChange, onPointerDown, onPointerUp,
}: {
  value: number; min: number; max: number; step: number; className?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min} max={max} step={step} value={value}
      onChange={onChange}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={`h-1 cursor-pointer appearance-none rounded-full
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
        [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:shadow-sm
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
        [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5
        [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary
        [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer
        ${className}`}
      style={{
        background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`,
      }}
    />
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

interface ClipPlayerProps {
  clip: ContestClip;
  autoPlay?: boolean;
}

export function ClipPlayer({ clip, autoPlay = false }: ClipPlayerProps) {
  const duration = clip.endSeconds - clip.startSeconds;

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(100);
  const prevVolumeRef = useRef(100);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDraggingRef = useRef(false);

  const startPolling = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (isDraggingRef.current || !playerRef.current) return;
      const rel = Math.max(0, playerRef.current.getCurrentTime() - clip.startSeconds);
      setProgress(Math.min(rel, duration));
    }, 250);
  };

  const stopPolling = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => {
    let mounted = true;
    loadYTApi(() => {
      if (!mounted || !iframeRef.current) return;
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onStateChange: ({ data }: { data: number }) => {
            if (data === 1) {
              setIsPlaying(true);
              setHasEnded(false);
              pauseForVideo();
              startPolling();
            } else if (data === 2) {
              setIsPlaying(false);
              resumeAfterVideo();
              stopPolling();
            } else if (data === 0) {
              setIsPlaying(false);
              setHasEnded(true);
              setProgress(0);
              resumeAfterVideo();
              stopPolling();
              playerRef.current?.seekTo(clip.startSeconds, true);
              playerRef.current?.pauseVideo();
            }
          },
        },
      });
    });
    return () => {
      mounted = false;
      stopPolling();
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  };

  const embedSrc = `https://www.youtube.com/embed/${clip.videoId}?start=${clip.startSeconds}&end=${clip.endSeconds}&autoplay=${autoPlay ? 1 : 0}&enablejsapi=1&controls=0&disablekb=1&modestbranding=1&rel=0`;

  return (
    <div className="flex flex-col">
      {/* Iframe */}
      <div className="relative w-full aspect-video bg-black/40">
        <iframe
          ref={iframeRef}
          src={embedSrc}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={clip.title}
        />
      </div>

      {/* Controls */}
      <div className="px-3 py-2 flex items-center gap-3 bg-black/30 border-t border-border/20">
        <Button
          size="sm"
          variant="outline"
          className="font-retro text-sm uppercase shrink-0 w-28 flex items-center gap-1.5"
          onClick={handlePlayPause}
        >
          {isPlaying
            ? <><Pause className="w-3 h-3" /> Pause</>
            : hasEnded
            ? <><RotateCcw className="w-3 h-3" /> Play Again</>
            : <><Play className="w-3 h-3" /> Play Clip</>}
        </Button>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-retro text-sm text-muted-foreground shrink-0 tabular-nums">{fmtTime(progress)}</span>
          <RangeSlider
            value={progress}
            min={0} max={duration} step={0.5}
            className="flex-1"
            onPointerDown={() => { isDraggingRef.current = true; }}
            onPointerUp={() => { isDraggingRef.current = false; }}
            onChange={(e) => {
              const val = Number(e.target.value);
              setProgress(val);
              playerRef.current?.seekTo(clip.startSeconds + val, true);
            }}
          />
          <span className="font-retro text-sm text-muted-foreground shrink-0 tabular-nums">{fmtTime(duration)}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              const next = volume === 0 ? prevVolumeRef.current || 100 : 0;
              setVolume(next);
              playerRef.current?.setVolume(next);
            }}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <RangeSlider
            value={volume}
            min={0} max={100} step={1}
            className="w-20"
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 0) prevVolumeRef.current = val;
              setVolume(val);
              playerRef.current?.setVolume(val);
            }}
          />
        </div>
      </div>
    </div>
  );
}
