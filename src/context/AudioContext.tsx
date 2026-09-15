import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

// Audio tracks available
export interface AudioTrack {
  id: string;
  name: string;
  description: string;
  color: string;
  // In a real app, this would be a require() or remote URL
  // For now we'll use placeholder - audio files need to be added to assets
  source?: any;
}

export const AUDIO_TRACKS: AudioTrack[] = [
  {
    id: 'brown_noise',
    name: 'Brown Noise',
    description: 'Deep Focus',
    color: '#8B4513',
  },
  {
    id: 'white_noise',
    name: 'White Noise',
    description: 'Concentration',
    color: '#E5E5E5',
  },
  {
    id: 'rain',
    name: 'Yağmur Sesi',
    description: 'Relax',
    color: '#60A5FA',
  },
  {
    id: 'forest',
    name: 'Orman',
    description: 'Nature',
    color: '#34D399',
  },
];

interface AudioContextType {
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  volume: number;
  isLoading: boolean;
  play: (trackId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  selectTrack: (trackId: string) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [volume, setVolumeState] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Initialize audio mode on mount
  React.useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.warn('Failed to setup audio mode:', error);
      }
    };
    setupAudio();

    // Cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const selectTrack = useCallback((trackId: string) => {
    const track = AUDIO_TRACKS.find((t) => t.id === trackId);
    if (track) {
      setCurrentTrack(track);
    }
  }, []);

  const play = useCallback(
    async (trackId?: string) => {
      try {
        setIsLoading(true);

        // If trackId provided, select that track
        if (trackId) {
          selectTrack(trackId);
        }

        const track = trackId
          ? AUDIO_TRACKS.find((t) => t.id === trackId)
          : currentTrack || AUDIO_TRACKS[0];

        if (!track) {
          console.warn('No track to play');
          return;
        }

        // Unload previous sound if exists
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        // For now, we'll just set state since we don't have actual audio files
        // In production, you would load the audio file here:
        // const { sound } = await Audio.Sound.createAsync(track.source, {
        //   isLooping: true,
        //   volume
        // });
        // soundRef.current = sound;
        // await sound.playAsync();

        setCurrentTrack(track);
        setIsPlaying(true);
        console.log('Playing:', track.name);
      } catch (error) {
        console.error('Error playing audio:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [currentTrack, volume, selectTrack]
  );

  const pause = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
      setIsPlaying(false);
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.playAsync();
      }
      setIsPlaying(true);
    } catch (error) {
      console.error('Error resuming audio:', error);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
      // Clearing the track dismisses the floating audio button too
      setCurrentTrack(null);
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  }, []);

  const setVolume = useCallback(async (newVolume: number) => {
    try {
      const clampedVolume = Math.max(0, Math.min(1, newVolume));
      setVolumeState(clampedVolume);
      if (soundRef.current) {
        await soundRef.current.setVolumeAsync(clampedVolume);
      }
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }, []);

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
