import { Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";

interface MusicToggleProps {
  muted: boolean;
  onToggle: () => void;
}

export function MusicToggle({ muted, onToggle }: MusicToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={muted ? "Unmute music" : "Mute music"}
      data-testid="button-music-toggle"
    >
      {muted ? (
        <VolumeX className="h-5 w-5" />
      ) : (
        <Volume2 className="h-5 w-5" />
      )}
      <span className="sr-only">{muted ? "Unmute music" : "Mute music"}</span>
    </Button>
  );
}
