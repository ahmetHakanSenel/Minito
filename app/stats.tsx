import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, BarChart3 } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import {
  FlowStateVisualizer,
  FocusEqualizer,
  SilentHeatmap,
  EnergyFlowBars,
} from '../src/components';
import { useProjects } from '../src/context/ProjectContext';
import { EmptyState } from '../src/components/feedback/EmptyState';
import {
  getFocusSessions,
  aggregateHourly,
  aggregateDaily,
  aggregateByProject,
  computeFlowMetrics,
  type FocusSessionRecord,
} from '../src/lib/stats/sessionStore';
import { haptics } from '../src/lib/ui/haptics';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYTICS SCREEN — computed from real recorded sessions only
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { projects } = useProjects();
  const [sessions, setSessions] = useState<FocusSessionRecord[]>([]);

  // Reload whenever the screen regains focus so fresh sessions appear
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getFocusSessions().then((loaded) => {
        if (!cancelled) setSessions(loaded);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const hourlyData = useMemo(() => aggregateHourly(sessions), [sessions]);
  const activityData = useMemo(() => aggregateDaily(sessions), [sessions]);
  const flowMetrics = useMemo(() => computeFlowMetrics(sessions), [sessions]);

  const projectEnergies = useMemo(() => {
    const minutesByProject = aggregateByProject(sessions);
    return projects
      .map((p) => ({
        id: p.id,
        name: p.title,
        type: 'other' as const,
        focusMinutes: Math.round(minutesByProject.get(p.id) ?? 0),
      }))
      .filter((p) => p.focusMinutes > 0)
      .sort((a, b) => b.focusMinutes - a.focusMinutes);
  }, [sessions, projects]);

  const hasTimedData = useMemo(
    () => sessions.some((s) => s.source === 'timer' && s.durationSec > 0),
    [sessions]
  );

  const handleBack = () => {
    haptics.tap();
    router.replace({
      pathname: '/',
      params: { openDashboard: 'true' },
    });
  };

  return (
    <View style={[styles.safeArea, { paddingTop: 40 }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('stats.title')}</Text>
        <View style={styles.backButton} />
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: Flow State Visualizer */}
        <FlowStateVisualizer
          focusQuality={flowMetrics.focusQuality}
          distractionLevel={flowMetrics.distractionLevel}
        />

        {hasTimedData ? (
          <>
            {/* Divider */}
            <View style={styles.sectionDivider} />

            {/* Chronotype: Focus Equalizer */}
            <FocusEqualizer hourlyData={hourlyData} />

            {/* Divider */}
            <View style={styles.sectionDivider} />

            {/* Consistency: Silent Heatmap */}
            <SilentHeatmap activityData={activityData} weeks={12} />

            {projectEnergies.length > 0 && (
              <>
                {/* Divider */}
                <View style={styles.sectionDivider} />

                {/* Project Distribution: Energy Flow */}
                <EnergyFlowBars projects={projectEnergies} maxProjects={5} />
              </>
            )}
          </>
        ) : (
          /* Honest empty state — no fabricated charts */
          <EmptyState
            icon={BarChart3}
            title={t('stats.emptyTitle')}
            description={t('stats.emptyText')}
            action={{ label: t('stats.emptyAction'), onPress: () => router.push('/planner') }}
          />
        )}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
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
    fontSize: 17,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 8,
  },
});
