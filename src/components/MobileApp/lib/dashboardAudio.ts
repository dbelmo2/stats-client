import { Howl } from 'howler';
import h3Theme from '../../game/sounds/h3-theme.mp3';

// Adjust this to set the dashboard background music volume (0.0 – 1.0)
export const DASHBOARD_MUSIC_VOLUME = 0.025;

const MUTE_STORAGE_KEY = 'dashboard:music-muted';

let howl: Howl | null = null;
let _muted = true;
let _pausedForVideo = false;

/**
 * Initialize dashboard music.
 * @param startMuted - true when landing directly on dashboard, false when coming from game
 * @param seekTo - seconds to seek to on play (for seamless game→dashboard handoff)
 */
export function init(startMuted: boolean, seekTo = 0): void {
    if (howl !== null) return;

    if (startMuted) {
        // Direct access: respect the user's stored preference, defaulting to muted
        const stored = localStorage.getItem(MUTE_STORAGE_KEY);
        _muted = stored !== null ? stored === 'true' : true;
    } else {
        // Coming from game where music was already playing — continue unmuted
        _muted = false;
    }

    howl = new Howl({
        src: [h3Theme],
        loop: true,
        volume: DASHBOARD_MUSIC_VOLUME,
    });

    if (!_muted) {
        if (howl.state() === 'loaded') {
            _startPlayback(seekTo);
        } else {
            howl.once('load', () => _startPlayback(seekTo));
        }
    }
}

function _startPlayback(seekTo: number): void {
    if (!howl) return;
    const id = howl.play();
    if (seekTo > 0) {
        howl.seek(seekTo, id);
    }
}

/**
 * Toggle music on/off.
 * Unmuting always starts from the beginning (music was not progressing while muted).
 */
export function toggleMute(): void {
    if (!howl) return;
    _muted = !_muted;
    if (_muted) {
        howl.stop();
    } else {
        howl.play();
    }
    try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(_muted));
    } catch {}
}

export function isMuted(): boolean {
    return _muted;
}

/**
 * Temporarily pause music while a video clip is playing.
 * Uses pause (not stop) so resumeAfterVideo restores the same position.
 * No-ops if already muted by the user or already paused for video.
 */
export function pauseForVideo(): void {
    if (_pausedForVideo || !howl || _muted) return;
    _pausedForVideo = true;
    howl.pause();
}

/**
 * Resume music after a video clip has stopped or paused.
 * Only resumes if we were the ones who paused it and the user hasn't since manually muted.
 */
export function resumeAfterVideo(): void {
    if (!_pausedForVideo) return;
    _pausedForVideo = false;
    if (!howl || _muted || howl.playing()) return;
    howl.play();
}
