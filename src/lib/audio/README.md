# Neuro-Sonic Ambience Setup

## Overview
This module provides ambient audio (brown noise/deep space drone) for Focus Mode with smooth fade in/out effects.

## Setup Instructions

### 1. Add Audio File
Create the following directory structure and add your audio file:

```
assets/
  audio/
    brown-noise.mp3  (or deep-space-drone.mp3)
```

### 2. Recommended Audio Specifications
- **Format**: MP3 (most compatible)
- **Duration**: 30-60 seconds (will loop automatically)
- **Volume**: Normalized to prevent clipping
- **Type**: Brown noise, white noise, or deep space drone ambience

### 3. Enable Audio in Code
Once you've added the audio file, update `ambientAudio.ts`:

```typescript
// In startAmbience function, replace the return statement with:
const audioSource = require('../../../assets/audio/brown-noise.mp3');

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
```

### 4. Free Audio Resources
- [Freesound.org](https://freesound.org) - Search for "brown noise" or "ambient drone"
- [Zapsplat](https://www.zapsplat.com) - Free sound effects library
- Generate your own using audio software like Audacity

## Features
- ✅ Smooth fade in (2 seconds) when Focus Mode starts
- ✅ Smooth fade out (2 seconds) when Focus Mode ends
- ✅ Loops seamlessly
- ✅ Volume set to 0.3 (30%) for subtle background ambience
- ✅ Gracefully handles missing audio files (app continues without audio)

## Usage
The audio automatically starts when entering Focus Mode and stops when leaving. No manual control needed.





