import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { haptics, setHapticsEnabled } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const originalOS = Platform.OS;
const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});

function runOn(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

beforeEach(() => {
  jest.clearAllMocks();
  setHapticsEnabled(true);
  runOn('ios');
});

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  vibrate.mockRestore();
});

describe('haptics', () => {
  it('maps the vocabulary onto the feedback generators', () => {
    haptics.tap();
    haptics.success();
    haptics.tick();

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('ticks with one very short pulse on Android, so fast dial turns stay clicks', () => {
    runOn('android');

    haptics.tick();

    expect(vibrate).toHaveBeenCalledTimes(1);
    const [duration] = vibrate.mock.calls[0];
    expect(typeof duration).toBe('number');
    // Shorter than the dial's minimum gap between ticks, so pulses never overlap into a buzz.
    expect(duration as number).toBeLessThan(60);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('does not touch the motor at all once turned off', () => {
    setHapticsEnabled(false);
    runOn('android');

    haptics.tap();
    haptics.tick();
    haptics.commit();
    haptics.error();

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('swallows rejections from devices without a haptic engine', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('no engine'));

    expect(() => haptics.selection()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the test run.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('survives a vibrator that throws synchronously', () => {
    runOn('android');
    vibrate.mockImplementationOnce(() => {
      throw new Error('no vibrator');
    });

    expect(() => haptics.tick()).not.toThrow();
  });
});
