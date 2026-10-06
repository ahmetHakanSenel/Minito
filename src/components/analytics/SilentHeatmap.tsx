import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { daysBefore, localDateKey } from '../../lib/time/calendar';

interface DayActivity {
  date: string; // YYYY-MM-DD format
  focusMinutes: number;
}

interface SilentHeatmapProps {
  /** Activity data for past days */
  activityData: DayActivity[];
  /** Number of weeks to display */
  weeks?: number;
}

// Get opacity based on focus minutes (normalized)
const getOpacity = (minutes: number, maxMinutes: number): number => {
  if (minutes === 0) return 0;
  // Normalize to 0.3-1.0 range for active cells
  const normalized = Math.min(minutes / Math.max(maxMinutes, 1), 1);
  return 0.3 + normalized * 0.7;
};

// Generate grid data from activity data
const generateGridData = (
  activityData: DayActivity[],
  weeks: number
): { date: string; opacity: number }[][] => {
  const today = new Date();
  const maxMinutes = Math.max(...activityData.map((d) => d.focusMinutes), 1);

  // Create a lookup map for quick access
  const activityMap = new Map<string, number>();
  activityData.forEach((d) => activityMap.set(d.date, d.focusMinutes));

  const grid: { date: string; opacity: number }[][] = [];

  // Generate weeks (columns)
  for (let w = weeks - 1; w >= 0; w--) {
    const weekData: { date: string; opacity: number }[] = [];

    // Generate 7 days (rows) for each week
    for (let d = 0; d < 7; d++) {
      // The local calendar day, the same key the aggregation files sessions under.
      const dateStr = localDateKey(daysBefore(today, w * 7 + (6 - d)));

      const minutes = activityMap.get(dateStr) || 0;
      weekData.push({
        date: dateStr,
        opacity: getOpacity(minutes, maxMinutes),
      });
    }

    grid.push(weekData);
  }

  return grid;
};

export const SilentHeatmap: React.FC<SilentHeatmapProps> = ({ activityData, weeks = 12 }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const gridData = useMemo(() => generateGridData(activityData, weeks), [activityData, weeks]);

  // Calculate cell size based on available width
  const padding = 40;
  const gap = 3;
  const availableWidth = width - padding * 2;
  const cellSize = Math.floor((availableWidth - (weeks - 1) * gap) / weeks);
  const actualCellSize = Math.min(cellSize, 16); // Cap at 16px

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.container}>
      <Text style={styles.sectionTitle}>{t('stats.consistency')}</Text>

      {/* Heatmap Grid */}
      <View style={styles.gridWrapper}>
        <View style={[styles.grid, { gap }]}>
          {gridData.map((week, weekIndex) => (
            <View key={weekIndex} style={[styles.column, { gap }]}>
              {week.map((day, dayIndex) => (
                <Animated.View
                  key={day.date}
                  entering={FadeIn.delay(weekIndex * 30 + dayIndex * 10).duration(300)}
                  style={[
                    styles.cell,
                    {
                      width: actualCellSize,
                      height: actualCellSize,
                      borderRadius: actualCellSize * 0.25,
                      backgroundColor:
                        day.opacity === 0
                          ? 'rgba(255, 255, 255, 0.05)'
                          : `rgba(139, 92, 246, ${day.opacity})`,
                    },
                    // Add subtle glow to high-activity cells
                    day.opacity > 0.7 && styles.glowCell,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Subtle legend - no numbers, just visual gradient */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendLabel}>{t('stats.legendLess')}</Text>
        <View style={styles.legendGradient}>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity, i) => (
            <View
              key={i}
              style={[
                styles.legendCell,
                {
                  backgroundColor: `rgba(139, 92, 246, ${opacity})`,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.legendLabel}>{t('stats.legendMore')}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  gridWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grid: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },
  cell: {
    // Dynamic sizing applied inline
  },
  glowCell: {
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    // `elevation` omitted on purpose — it would ring each tiny cell with a
    // grey square on Android instead of the intended violet bloom.
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  legendLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    fontWeight: '400',
  },
  legendGradient: {
    flexDirection: 'row',
    gap: 2,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});

export default SilentHeatmap;
