import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

interface HourlyFocusData {
  hour: number; // 0-23
  focusMinutes: number;
}

interface FocusEqualizerProps {
  /** Array of hourly focus data */
  hourlyData: HourlyFocusData[];
}

// Group hours into 3-hour buckets for cleaner visualization
const aggregateData = (data: HourlyFocusData[]) => {
  const buckets: { label: string; value: number; isMax?: boolean }[] = [];

  // Create 8 buckets (3 hours each)
  for (let i = 0; i < 24; i += 3) {
    const bucketData = data.filter((d) => d.hour >= i && d.hour < i + 3);
    const totalMinutes = bucketData.reduce((sum, d) => sum + d.focusMinutes, 0);

    // Only show specific labels
    let label = '';
    if (i === 6) label = '06:00';
    else if (i === 12) label = '12:00';
    else if (i === 18) label = '18:00';
    else if (i === 0) label = '00:00';

    buckets.push({
      label,
      value: totalMinutes,
    });
  }

  // Find and mark the max bucket
  const maxValue = Math.max(...buckets.map((b) => b.value));
  buckets.forEach((b) => {
    if (b.value === maxValue && maxValue > 0) {
      b.isMax = true;
    }
  });

  return buckets;
};

// Format hour to display time
const formatPeakTime = (bucketIndex: number): string => {
  const startHour = bucketIndex * 3;
  const endHour = startHour + 3;
  return `${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`;
};

export const FocusEqualizer: React.FC<FocusEqualizerProps> = ({ hourlyData }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const chartData = useMemo(() => aggregateData(hourlyData), [hourlyData]);
  const peakBucketIndex = useMemo(() => {
    const maxVal = Math.max(...chartData.map((b) => b.value));
    return chartData.findIndex((b) => b.value === maxVal);
  }, [chartData]);

  const peakTime = formatPeakTime(peakBucketIndex);
  const hasData = chartData.some((d) => d.value > 0);

  // Calculate bar width based on screen
  const chartWidth = width - 80;
  const barWidth = Math.floor(chartWidth / 10);
  const spacing = Math.floor(chartWidth / 24);

  // Transform data for gifted-charts
  const barData = chartData.map((item, index) => ({
    value: item.value,
    label: item.label,
    frontColor: item.isMax ? '#A78BFA' : '#8B5CF6',
    gradientColor: item.isMax ? '#C4B5FD' : '#A78BFA',
    topLabelComponent: () => null,
    barBorderTopLeftRadius: 6,
    barBorderTopRightRadius: 6,
    // Add glow effect to max bar
    // The peak bar is emphasised by colour alone. An `elevation` glow here
    // renders as a grey rectangle behind the bar on Android/OLED.
    ...(item.isMax && {
      barStyle: {
        shadowColor: '#A78BFA',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 12,
      },
    }),
  }));

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.container}>
      <Text style={styles.sectionTitle}>{t('stats.focusRhythm')}</Text>

      <View style={styles.chartContainer}>
        {hasData ? (
          <BarChart
            data={barData}
            width={chartWidth}
            height={120}
            barWidth={barWidth}
            spacing={spacing}
            noOfSections={4}
            hideYAxisText
            hideRules
            yAxisThickness={0}
            xAxisThickness={0}
            xAxisLabelTextStyle={styles.xAxisLabel}
            isAnimated
            animationDuration={800}
            showGradient
            gradientColor="rgba(139, 92, 246, 0)"
            backgroundColor="transparent"
            barBorderRadius={6}
            disablePress
            disableScroll
            frontColor="#8B5CF6"
            initialSpacing={spacing}
            endSpacing={spacing}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('stats.noData')}</Text>
          </View>
        )}
      </View>

      {/* Insight text */}
      {hasData && (
        <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.insightContainer}>
          <View style={styles.insightDot} />
          <Text style={styles.insightText}>
            {t('stats.peakTime')} <Text style={styles.insightHighlight}>{peakTime}</Text>
          </Text>
        </Animated.View>
      )}
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
  chartContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  xAxisLabel: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 10,
    fontWeight: '400',
  },
  emptyState: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
  },
  insightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A78BFA',
    marginRight: 8,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  insightText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
  },
  insightHighlight: {
    color: '#C4B5FD',
    fontWeight: '600',
  },
});

export default FocusEqualizer;
