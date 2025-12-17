import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

/**
 * GOD MODE: Neuro-Sonic Ambience Hook
 * Manages brown noise/deep space drone audio with fade in/out
 * 
 * Usage:
 * const { startAmbience, stopAmbience, isPlaying } = useAmbientAudio();
 */
export const useAmbientAudio = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio mode on mount
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });

    return () => {
      // Cleanup on unmount
      if (sound) {
        sound.unloadAsync().catch(console.warn);
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  /**
   * Fade in audio smoothly over 2 seconds
   */
  const fadeIn = async (audioSound: Audio.Sound, targetVolume: number = 0.3) => {
    const steps = 20; // 20 steps for smooth fade
    const stepDuration = 2000 / steps; // 2 seconds total
    const volumeStep = targetVolume / steps;

    let currentVolume = 0;
    await audioSound.setVolumeAsync(0);

    return new Promise<void>((resolve) => {
      let step = 0;
      fadeIntervalRef.current = setInterval(() => {
        step++;
        currentVolume += volumeStep;
        
        if (step >= steps) {
          audioSound.setVolumeAsync(targetVolume);
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
          resolve();
        } else {
          audioSound.setVolumeAsync(currentVolume);
        }
      }, stepDuration);
    });
  };

  /**
   * Fade out audio smoothly over 2 seconds
   */
  const fadeOut = async (audioSound: Audio.Sound) => {
    const steps = 20; // 20 steps for smooth fade
    const stepDuration = 2000 / steps; // 2 seconds total
    const currentVolume = (await audioSound.getStatusAsync()).volume || 0.3;
    const volumeStep = currentVolume / steps;

    return new Promise<void>((resolve) => {
      let step = 0;
      fadeIntervalRef.current = setInterval(async () => {
        step++;
        const newVolume = Math.max(0, currentVolume - volumeStep * step);
        
        if (step >= steps) {
          await audioSound.setVolumeAsync(0);
          await audioSound.pauseAsync();
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
          resolve();
        } else {
          await audioSound.setVolumeAsync(newVolume);
        }
      }, stepDuration);
    });
  };

  /**
   * Start ambient audio with fade in
   * 
   * SETUP INSTRUCTIONS:
   * 1. Create assets/audio/ directory in project root
   * 2. Add a brown-noise.mp3 or deep-space-drone.mp3 file
   * 3. Uncomment the audioSource line below and update the path
   * 
   * Example: const audioSource = require('../../../assets/audio/brown-noise.mp3');
   * 
   * The app will work perfectly fine without the audio file - it gracefully skips if missing.
   */
  const startAmbience = async () => {
    if (isPlaying || sound) {
      return; // Already playing
    }

    try {
      // TODO: Uncomment and update path after adding audio file to assets/audio/
      // const audioSource = require('../../../assets/audio/brown-noise.mp3');
      
      // For now, gracefully skip if audio file not added yet
      // Uncomment the block below once you've added the audio file:
      /*
      const { sound: audioSound } = await Audio.Sound.createAsync(
        audioSource,
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0,
        }
      );

      setSound(audioSound);
      setIsPlaying(true);
      
      // Fade in over 2 seconds
      await fadeIn(audioSound, 0.3);
      */
      
      // Silent return if audio file not configured
      // Check console for setup instructions
      if (__DEV__) {
        console.log('💡 Ambient audio: Add brown-noise.mp3 to assets/audio/ and uncomment code in ambientAudio.ts to enable');
      }
    } catch (error) {
      console.warn('Failed to load ambient audio:', error);
      // Gracefully fail - app continues without audio
      setIsPlaying(false);
    }
  };

  /**
   * Stop ambient audio with fade out
   */
  const stopAmbience = async () => {
    if (!sound || !isPlaying) {
      return;
    }

    try {
      await fadeOut(sound);
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    } catch (error) {
      console.warn('Error stopping ambient audio:', error);
      // Try to clean up anyway
      try {
        if (sound) {
          await sound.unloadAsync();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      setSound(null);
      setIsPlaying(false);
    }
  };

  return {
    startAmbience,
    stopAmbience,
    isPlaying,
  };
};

