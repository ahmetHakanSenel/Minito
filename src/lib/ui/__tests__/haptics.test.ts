import { Platform } from 'react-native';
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
  it('maps the vocabulary onto the feedback generators', () => {
    haptics.tap();
    haptics.success();
    haptics.tick();

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('ticks with the short, firm impact on Android rather than the long selection pulse', () => {
    runOn('android');

    haptics.tick();

    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
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
  });

  it('swallows rejections from devices without a haptic engine', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('no engine'));

    expect(() => haptics.selection()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the test run.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('survives a haptics module that throws synchronously', () => {
    jest.mocked(Haptics.impactAsync).mockImplementationOnce(() => {
      throw new Error('no vibrator');
    });

    expect(() => haptics.tap()).not.toThrow();
  });
});
