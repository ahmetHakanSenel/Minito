import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio';

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

/** A native player plus its status subscription; both are released together. */
type LoadedPlayer = { player: AudioPlayer; subscription: { remove: () => void } };

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

  React.useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Players are native objects that live until released; nothing may outlive the provider.
  const releasePlayer = useCallback(() => {
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
  }, []);

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

      releasePlayer();
      setIsLoading(true);
      try {
        const player = createAudioPlayer(track.source, { updateInterval: 1000 });
        const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (status.isLoaded) setIsLoading(false);
        });
        loadedRef.current = { player, subscription };

        player.loop = true;
        player.volume = volumeRef.current;
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
    [releasePlayer]
  );

  const pause = useCallback(async () => {
    try {
      loadedRef.current?.player.pause();
      setIsPlaying(false);
    } catch (error) {
      console.warn('Error pausing audio:', error);
    }
  }, []);

  const resume = useCallback(async () => {
    const loaded = loadedRef.current;
    if (!loaded) {
      await play(currentTrackRef.current?.id);
      return;
    }
    try {
      loaded.player.play();
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      console.warn('Error resuming audio:', error);
    }
  }, [play]);

  const stop = useCallback(async () => {
    releasePlayer();
    setIsLoading(false);
    setIsPlaying(false);
    setCurrentTrack(null);
  }, [releasePlayer]);

  const setVolume = useCallback(async (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    volumeRef.current = clampedVolume;
    setVolumeState(clampedVolume);
    try {
      if (loadedRef.current) {
        loadedRef.current.player.volume = clampedVolume;
      }
    } catch (error) {
      console.warn('Error setting volume:', error);
    }
  }, []);

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
