import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio';
import { FADE_IN_MS, FADE_OUT_MS, FADE_STEP_MS, FADE_SWITCH_MS, volumeAt } from '../lib/audio/fade';

// Audio tracks available
export interface AudioTrack {
  /** Also the key under audio.tracks for the track's localized name and description. */
  id: string;
  color: string;
  source: AudioSource;
}

export const AUDIO_TRACKS: AudioTrack[] = [
  {
    id: 'deep_brown',
    color: '#A16207',
    source: require('../../assets/audio/continious-deepbrown.m4a'),
  },
  {
    id: 'infinite_drift',
    color: '#8B5CF6',
    source: require('../../assets/audio/Infinite Drift.m4a'),
  },
  {
    id: 'rushing_river',
    color: '#60A5FA',
    source: require('../../assets/audio/Rushing River Dreams.m4a'),
  },
  {
    id: 'theta_focus',
    color: '#34D399',
    source: require('../../assets/audio/bineural-thetafrq.m4a'),
  },
  {
    id: 'slow_binaural',
    color: '#F472B6',
    source: require('../../assets/audio/slow-bineural-6hz.m4a'),
  },
  {
    id: 'ambient_pulse',
    color: '#38BDF8',
    source: require('../../assets/audio/ambient-60bpm-bineural.m4a'),
  },
  {
    id: 'modern_classical',
    color: '#C4B5FD',
    source: require('../../assets/audio/modernclasical.m4a'),
  },
];

interface AudioContextType {
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  volume: number;
  /** True from the moment a track is requested until its audio has loaded. */
  isLoading: boolean;
  play: (trackId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  selectTrack: (trackId: string) => void;
  /**
   * Remembers what was playing before a focus session. Idempotent within one session, so the
   * setup sheet and the timer can both call it.
   */
  beginAudioSession: () => void;
  /** Switches the session's ambience; `null` is silence. The pre-session track is not lost. */
  setSessionTrack: (trackId: string | null) => Promise<void>;
  /** Puts back exactly what was playing (or paused) before the session began. */
  endAudioSession: () => Promise<void>;
}

type SessionSnapshot = { trackId: string | null; wasPlaying: boolean };

/**
 * `AudioPlayer` inherits `addListener` from expo-modules-core, which TypeScript cannot see here:
 * the package ships nested inside `expo` and is not meant to be installed directly. The shape is
 * declared locally instead of pulling in a dependency that Expo tells apps not to depend on.
 */
type StatusSubscription = { remove: () => void };

type ListeningPlayer = AudioPlayer & {
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: AudioStatus) => void
  ): StatusSubscription;
};

/** A native player plus its status subscription; both are released together. */
type LoadedPlayer = { player: AudioPlayer; subscription: StatusSubscription };

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [volume, setVolumeState] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);

  const loadedRef = useRef<LoadedPlayer | null>(null);
  // Mirrors of the state above, for session calls that run after an await and must not read a
  // stale closure.
  const currentTrackRef = useRef<AudioTrack | null>(null);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(0.7);
  const sessionSnapshotRef = useRef<SessionSnapshot | null>(null);
  // The ramp in flight, with the promise waiting on it. Cancelling has to settle that promise:
  // a caller awaiting a fade it no longer owns must still be let go.
  const fadeRef = useRef<{
    timer: ReturnType<typeof setInterval>;
    settle: (reachedTarget: boolean) => void;
  } | null>(null);

  React.useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const cancelFade = useCallback((reachedTarget = false) => {
    const fade = fadeRef.current;
    fadeRef.current = null;
    if (!fade) return;
    clearInterval(fade.timer);
    fade.settle(reachedTarget);
  }, []);

  /**
   * Walks a player's volume to `target`, resolving true when it arrives.
   *
   * It always resolves. When the ramp is cut short — the player released, another track taking
   * over, a hand on the volume slider — it resolves false instead of leaving the caller waiting
   * on a fade that will never finish, and false is the caller's cue that someone else now owns
   * this player and it should keep its hands off.
   */
  const fadeTo = useCallback(
    (player: AudioPlayer, target: number, durationMs: number) =>
      new Promise<boolean>((resolve) => {
        cancelFade();
        const from = player.volume;
        if (durationMs <= 0 || Math.abs(from - target) < 0.01) {
          try {
            player.volume = target;
          } catch {
            // Already released: there is nothing left to set it on.
          }
          resolve(true);
          return;
        }

        const startedAt = Date.now();
        const timer = setInterval(() => {
          // Another track has taken over: this ramp is writing to a player nobody can hear.
          if (loadedRef.current?.player !== player) {
            cancelFade();
            return;
          }
          const elapsed = Date.now() - startedAt;
          try {
            player.volume = volumeAt(from, target, elapsed, durationMs);
          } catch {
            cancelFade();
            return;
          }
          if (elapsed >= durationMs) cancelFade(true);
        }, FADE_STEP_MS);
        fadeRef.current = { timer, settle: resolve };
      }),
    [cancelFade]
  );

  // Players are native objects that live until released; nothing may outlive the provider.
  const releasePlayer = useCallback(() => {
    cancelFade();
    const loaded = loadedRef.current;
    loadedRef.current = null;
    if (!loaded) return;
    loaded.subscription.remove();
    try {
      loaded.player.pause();
      loaded.player.remove();
    } catch (error) {
      console.warn('Error releasing audio player:', error);
    }
  }, [cancelFade]);

  React.useEffect(() => {
    // Ambience keeps playing while the person is off doing the step, which is the whole point.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch((error) => console.warn('Failed to set up audio mode:', error));

    return releasePlayer;
  }, [releasePlayer]);

  const selectTrack = useCallback((trackId: string) => {
    const track = AUDIO_TRACKS.find((t) => t.id === trackId);
    if (track) {
      setCurrentTrack(track);
    }
  }, []);

  const play = useCallback(
    async (trackId?: string) => {
      const track = trackId
        ? AUDIO_TRACKS.find((t) => t.id === trackId)
        : (currentTrackRef.current ?? AUDIO_TRACKS[0]);
      if (!track) {
        console.warn('No track to play');
        return;
      }

      // Changing tracks: let the outgoing one leave rather than cutting it off mid-note.
      const outgoing = loadedRef.current;
      if (outgoing && isPlayingRef.current) {
        await fadeTo(outgoing.player, 0, FADE_SWITCH_MS);
      }

      releasePlayer();
      setIsLoading(true);
      try {
        const player = createAudioPlayer(track.source, { updateInterval: 1000 }) as ListeningPlayer;
        // The fade-in waits for the first loaded status. Ramping a player that has not started
        // yet would spend the fade in silence, and the track would still arrive at full volume.
        let fadedIn = false;
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (!status.isLoaded) return;
          setIsLoading(false);
          if (fadedIn) return;
          fadedIn = true;
          void fadeTo(player, volumeRef.current, FADE_IN_MS);
        });
        loadedRef.current = { player, subscription };

        // An ambience shorter than the session simply comes round again: a four-minute track
        // under a forty-minute session repeats ten times, seamlessly, from the same decoded
        // asset. Nothing in the app needs to know how long a track is.
        player.loop = true;
        player.volume = 0;
        // Playback starts as soon as the asset has loaded.
        player.play();

        setCurrentTrack(track);
        setIsPlaying(true);
      } catch (error) {
        releasePlayer();
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentTrack(null);
        console.warn('Error playing audio:', error);
      }
    },
    [releasePlayer, fadeTo]
  );

  const pause = useCallback(async () => {
    const loaded = loadedRef.current;
    if (!loaded) {
      setIsPlaying(false);
      return;
    }
    try {
      // Cut short means something else — a new track, a stop — is already handling this player.
      if (!(await fadeTo(loaded.player, 0, FADE_OUT_MS))) return;
      if (loadedRef.current !== loaded) return;
      loaded.player.pause();
      setIsPlaying(false);
    } catch (error) {
      console.warn('Error pausing audio:', error);
    }
  }, [fadeTo]);

  const resume = useCallback(async () => {
    const loaded = loadedRef.current;
    if (!loaded) {
      await play(currentTrackRef.current?.id);
      return;
    }
    try {
      // From silence, so coming back sounds like the fade that paused it, in reverse.
      loaded.player.volume = 0;
      loaded.player.play();
      setIsPlaying(true);
      await fadeTo(loaded.player, volumeRef.current, FADE_IN_MS);
    } catch (error) {
      setIsPlaying(false);
      console.warn('Error resuming audio:', error);
    }
  }, [play, fadeTo]);

  const stop = useCallback(async () => {
    const loaded = loadedRef.current;
    if (loaded && isPlayingRef.current) {
      // The long fade. This is a session ending, and it should sound like one.
      await fadeTo(loaded.player, 0, FADE_OUT_MS);
    }
    releasePlayer();
    setIsLoading(false);
    setIsPlaying(false);
    setCurrentTrack(null);
  }, [releasePlayer, fadeTo]);

  const setVolume = useCallback(
    async (newVolume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, newVolume));
      volumeRef.current = clampedVolume;
      setVolumeState(clampedVolume);
      // A hand on the slider outranks a fade still running underneath it.
      cancelFade();
      try {
        if (loadedRef.current) {
          loadedRef.current.player.volume = clampedVolume;
        }
      } catch (error) {
        console.warn('Error setting volume:', error);
      }
    },
    [cancelFade]
  );

  // --------------------------------------------------------------------------
  // Focus sessions borrow the player and hand it back.
  //
  // A session may pick its own ambience, or silence. Whatever the person was listening to on the
  // home screen is paused for the session rather than thrown away, and restored when it ends.
  // --------------------------------------------------------------------------

  const beginAudioSession = useCallback(() => {
    if (sessionSnapshotRef.current) return;
    sessionSnapshotRef.current = {
      trackId: currentTrackRef.current?.id ?? null,
      wasPlaying: isPlayingRef.current,
    };
  }, []);

  const setSessionTrack = useCallback(
    async (trackId: string | null) => {
      if (!trackId) {
        if (isPlayingRef.current) await pause();
        return;
      }
      if (currentTrackRef.current?.id === trackId && loadedRef.current) {
        // Same track: keep its position instead of restarting it.
        if (!isPlayingRef.current) await resume();
        return;
      }
      await play(trackId);
    },
    [pause, resume, play]
  );

  const endAudioSession = useCallback(async () => {
    const snapshot = sessionSnapshotRef.current;
    sessionSnapshotRef.current = null;
    if (!snapshot) return;

    if (snapshot.wasPlaying && snapshot.trackId) {
      await setSessionTrack(snapshot.trackId);
      return;
    }

    if (snapshot.trackId && currentTrackRef.current?.id === snapshot.trackId) {
      // Same track as before, which was paused before: pause it again, position intact.
      if (isPlayingRef.current) await pause();
      return;
    }

    // The session replaced the track. Release it, and leave the previous one selected but silent,
    // exactly as it was; resuming it later reloads it on demand.
    await stop();
    if (snapshot.trackId) selectTrack(snapshot.trackId);
  }, [setSessionTrack, pause, stop, selectTrack]);

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        currentTrack,
        volume,
        isLoading,
        play,
        pause,
        resume,
        stop,
        setVolume,
        selectTrack,
        beginAudioSession,
        setSessionTrack,
        endAudioSession,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
};
