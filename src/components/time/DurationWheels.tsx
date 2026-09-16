import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { joinDuration, splitDuration } from '../../lib/time/duration';
import { WHEEL_HEIGHT, WheelPicker } from './WheelPicker';

// Stable identity: an inline formatter would re-render every row of the wheel on each change.
const formatHours = (hours: number) => String(hours);

type DurationWheelsProps = {
  /** Whole seconds. */
  value: number;
  onChange: (seconds: number) => void;
  /** Hours wheel shows 0 … maxHours. Omit for a minutes + seconds dial. */
  maxHours?: number;
};

/**
 * Hours (optional), minutes and seconds as three endless wheels, one value in whole seconds.
 */
export function DurationWheels({ value, onChange, maxHours }: DurationWheelsProps) {
  const { t } = useTranslation();
  const parts = splitDuration(value);
  const showHours = maxHours !== undefined;

  const update = useCallback(
    (field: 'hours' | 'minutes' | 'seconds', next: number) => {
      onChange(joinDuration({ ...splitDuration(value), [field]: next }));
    },
    [onChange, value]
  );

  return (
    <View style={styles.row}>
      {showHours ? (
        <>
          <Column label={t('wheel.hoursShort')}>
            <WheelPicker
              count={maxHours + 1}
              value={Math.min(parts.hours, maxHours)}
              onChange={(next) => update('hours', next)}
              formatValue={formatHours}
              width={56}
              accessibilityLabel={t('wheel.hours')}
            />
          </Column>
          <Separator />
        </>
      ) : null}
      <Column label={t('wheel.minutesShort')}>
        <WheelPicker
          count={60}
          value={parts.minutes}
          onChange={(next) => update('minutes', next)}
          accessibilityLabel={t('wheel.minutes')}
        />
      </Column>
      <Separator />
      <Column label={t('wheel.secondsShort')}>
        <WheelPicker
          count={60}
          value={parts.seconds}
          onChange={(next) => update('seconds', next)}
          accessibilityLabel={t('wheel.seconds')}
        />
      </Column>
    </View>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.column}>
      {children}
      <Text style={styles.unit}>{label}</Text>
    </View>
  );
}

function Separator() {
  return (
    <View style={styles.separator}>
      <Text style={styles.colon}>:</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  column: {
    alignItems: 'center',
  },
  unit: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
  },
  separator: {
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  colon: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
