import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { haptics, setHapticsEnabled } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  performAndroidHapticsAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: {
    Clock_Tick: 'clock-tick',
    Segment_Tick: 'segment-tick',
    Virtual_Key: 'virtual-key',
    Context_Click: 'context-click',
    Long_Press: 'long-press',
    Confirm: 'confirm',
    Reject: 'reject',
  },
}));

const originalOS = Platform.OS;

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
});

describe('haptics', () => {
  it('uses the iOS feedback generators on iOS', () => {
    haptics.tap();
    haptics.success();
    haptics.tick();

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it('uses the haptic engine on Android instead of buzzing the vibration motor', () => {
    runOn('android');

    haptics.tick();
    haptics.selection();
    haptics.tap();
    haptics.success();

    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(1, 'clock-tick');
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(2, 'segment-tick');
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(3, 'virtual-key');
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenNthCalledWith(4, 'confirm');
    // The motor-simulated APIs are never touched on Android.
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('does not touch the engine at all once turned off', () => {
    setHapticsEnabled(false);

    haptics.tap();
    haptics.tick();
    haptics.commit();
    haptics.error();

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it('swallows rejections from devices without a haptic engine', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('no engine'));

    expect(() => haptics.selection()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the test run.
    await new Promise((resolve) => setImmediate(resolve));
  });
});
