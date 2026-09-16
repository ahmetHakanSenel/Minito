import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Play, Pause, Volume2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAudioContext, AUDIO_TRACKS } from '../src/context';
import { haptics } from '../src/lib/ui/haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

interface SoundCardProps {
  track: (typeof AUDIO_TRACKS)[0];
  isActive: boolean;
  isPlaying: boolean;
  onPress: () => void;
  index: number;
}

const SoundCard: React.FC<SoundCardProps> = ({ track, isActive, isPlaying, onPress, index }) => {
  const { t } = useTranslation();
  return (
    <AnimatedView entering={FadeInDown.delay(index * 60).duration(300)}>
      <TouchableOpacity
        style={[styles.soundCard, isActive && styles.soundCardActive]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.soundIcon, { backgroundColor: `${track.color}20` }]}>
          <Volume2 size={24} color={track.color} strokeWidth={2} />
        </View>
        <View style={styles.soundInfo}>
          <Text style={styles.soundName}>{t(`audio.tracks.${track.id}.name`)}</Text>
          <Text style={styles.soundDesc}>{t(`audio.tracks.${track.id}.description`)}</Text>
        </View>
        {isActive && (
          <View style={[styles.playIndicator, { backgroundColor: track.color }]}>
            {isPlaying ? (
              <Pause size={16} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
            ) : (
              <Play size={16} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
            )}
          </View>
        )}
      </TouchableOpacity>
    </AnimatedView>
  );
};

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function SoundsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTrack, isPlaying, play, pause, resume } = useAudioContext();

  const handleBack = () => {
    haptics.tap();
    // Navigate back to home and open DashboardModal (Control Center)
    router.replace({
      pathname: '/',
      params: { openDashboard: 'true' },
    });
  };

  const handleTrackPress = async (trackId: string) => {
    haptics.tap();

    if (currentTrack?.id === trackId) {
      if (isPlaying) {
        await pause();
      } else {
        await resume();
      }
    } else {
      await play(trackId);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('audio.title')}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Sound List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t('audio.sectionTitle')}</Text>
        <Text style={styles.sectionSubtitle}>{t('audio.sectionSubtitle')}</Text>

        <View style={styles.soundsList}>
          {AUDIO_TRACKS.map((track, index) => (
            <SoundCard
              key={track.id}
              track={track}
              isActive={currentTrack?.id === track.id}
              isPlaying={currentTrack?.id === track.id && isPlaying}
              onPress={() => handleTrackPress(track.id)}
              index={index}
            />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 24,
  },
  soundsList: {
    gap: 12,
  },
  soundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  soundCardActive: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  soundIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  soundDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  playIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
