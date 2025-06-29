import { Howl, Howler } from 'howler';
import { SettingsManager } from './SettingsManager';

type AudioCategory = 'sfx' | 'music' | 'ui' | 'ambient';

export interface SoundConfig {
    src: string[];
    volume?: number;
    loop?: boolean;
    autoplay?: boolean;
    preload?: boolean;
    sprite?: Record<string, [number, number]>;
    rate?: number;
}

interface SoundReference {
    howl: Howl;
    category: AudioCategory;
    baseVolume: number;
    id?: number;
}

export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<string, SoundReference> = new Map();
    private muted: boolean = false;
    private categoryMutes: Partial<Record<AudioCategory, boolean>> = {};
    private settingsManager: SettingsManager;
    private musicFadeTime: number = 1000;
    private currentMusic: string | null = null;

    private constructor() {
        this.settingsManager = SettingsManager.getInstance();
        Howler.autoUnlock = true;
        Howler.html5PoolSize = 10;
        this.applyVolumeSettings();
        this.settingsManager.onVolumeChange((category: AudioCategory, volume: number) => {
            this.applyVolumeSettings();
            console.log(`Volume for ${category} changed to ${volume}`);
        });

    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public registerSound(soundId: string, config: SoundConfig, category: AudioCategory = 'sfx'): void {
        if (this.sounds.has(soundId)) {
            console.warn(`Sound ${soundId} already registered. Skipping.`);
            return;
        }

        const defaultVolume = category === 'music' ? 0.5 : 0.8;
        const defaultLoop = category === 'music' || category === 'ambient';
        const baseVolume = config.volume ?? defaultVolume;

        const howl = new Howl({
            src: config.src,
            volume: this.getAdjustedVolume(baseVolume, category),
            loop: config.loop ?? defaultLoop,
            autoplay: config.autoplay ?? false,
            preload: config.preload ?? true,
            sprite: config.sprite,
            rate: config.rate ?? 1.0
        });

        this.sounds.set(soundId, {
            howl,
            category,
            baseVolume
        });

        console.log(`Sound ${soundId} registered as ${category}`);
    }

    public play(soundId: string, spriteName?: string): number | undefined {
        const sound = this.sounds.get(soundId);

        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return undefined;
        }

        if (this.muted || this.categoryMutes[sound.category]) return undefined;

        if (sound.category === 'music') {
            return this.playMusic(soundId);
        }

        const id = spriteName
            ? sound.howl.play(spriteName)
            : sound.howl.play();

        sound.id = id;
        return id;
    }

    private playMusic(soundId: string): number | undefined {
        if (this.currentMusic === soundId && this.sounds.get(soundId)?.howl.playing()) {
            return this.sounds.get(soundId)?.id;
        }

        if (this.currentMusic && this.sounds.has(this.currentMusic)) {
            const currentMusic = this.sounds.get(this.currentMusic)!;
            currentMusic.howl.fade(currentMusic.howl.volume(), 0, this.musicFadeTime);
            setTimeout(() => {
                currentMusic.howl.stop();
            }, this.musicFadeTime);
        }

        const music = this.sounds.get(soundId)!;
        music.howl.volume(0);
        const id = music.howl.play();
        music.id = id;
        music.howl.fade(0, this.getAdjustedVolume(music.baseVolume, 'music'), this.musicFadeTime);
        this.currentMusic = soundId;
        return id;
    }

    public stop(soundId: string): void {
        const sound = this.sounds.get(soundId);

        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }

        if (sound.category === 'music') {
            sound.howl.fade(sound.howl.volume(), 0, this.musicFadeTime);
            setTimeout(() => {
                sound.howl.stop();
                if (this.currentMusic === soundId) {
                    this.currentMusic = null;
                }
            }, this.musicFadeTime);
        } else {
            sound.howl.stop();
        }

        sound.id = undefined;
    }

    public pause(soundId: string): void {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }
        sound.howl.pause();
    }

    public resume(soundId: string): void {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }

        if (sound.id !== undefined) {
            sound.howl.play(sound.id);
        } else {
            sound.id = sound.howl.play();
        }
    }

    public muteAll(): void {
        this.muted = true;
        Howler.mute(true);
    }

    public unmuteAll(): void {
        this.muted = false;
        Howler.mute(false);
        this.applyVolumeSettings();
    }

    public muteCategory(category: AudioCategory): void {
        this.categoryMutes[category] = true;
        this.applyVolumeSettings();
    }

    public unmuteCategory(category: AudioCategory): void {
        this.categoryMutes[category] = false;
        this.applyVolumeSettings();
    }

    public stopAll(): void {
        this.sounds.forEach((sound) => {
            sound.howl.stop();
            sound.id = undefined;
        });
        this.currentMusic = null;
    }

    public applyVolumeSettings(): void {
        this.sounds.forEach((sound) => {
            const volume = this.categoryMutes[sound.category] ? 0 : this.getAdjustedVolume(sound.baseVolume, sound.category);
            sound.howl.volume(volume);
        });
    }

    private getAdjustedVolume(baseVolume: number, category: AudioCategory): number {
        if (category === 'music') {
            return baseVolume * this.settingsManager.getMusicVolume();
        } else {
            return baseVolume * this.settingsManager.getSfxVolume();
        }
    }

    public setVolume(soundId: string, volume: number): void {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return;
        }

        sound.baseVolume = Math.max(0, Math.min(1, volume));
        sound.howl.volume(this.getAdjustedVolume(sound.baseVolume, sound.category));
    }

    public isPlaying(soundId: string): boolean {
        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`Sound ${soundId} not found.`);
            return false;
        }
        return sound.howl.playing();
    }

    public preloadAll(): Promise<void> {
        const loadPromises: Promise<void>[] = [];

        this.sounds.forEach((sound, id) => {
            if (!sound.howl.state() || sound.howl.state() === 'unloaded') {
                const loadPromise = new Promise<void>((resolve) => {
                    sound.howl.once('load', () => {
                        console.log(`Sound ${id} loaded successfully.`);
                        resolve();
                    });

                    sound.howl.once('loaderror', () => {
                        console.error(`Failed to load sound ${id}.`);
                        resolve();
                    });

                    sound.howl.load();
                });

                loadPromises.push(loadPromise);
            }
        });

        return Promise.all(loadPromises).then(() => {
            console.log('All sounds loaded.');
        });
    }

    public playOneShot(config: SoundConfig, category: AudioCategory = 'sfx'): void {
        if (config.loop) {
            console.warn("playOneShot() is not intended for looping sounds.");
        }

        const tempId = `oneshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        this.registerSound(tempId, config, category);

        const sound = this.sounds.get(tempId)!;
        sound.howl.play();

        sound.howl.once('end', () => {
            sound.howl.unload();
            this.sounds.delete(tempId);
        });
    }
}
