import * as Haptics from 'expo-haptics';
import { haptics, setHapticsEnabled } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  setHapticsEnabled(true);
});

describe('haptics', () => {
  it('vibrates while enabled', () => {
    haptics.tap();
    haptics.success();

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('does not touch the engine at all once turned off', () => {
    setHapticsEnabled(false);

    haptics.tap();
    haptics.selection();
    haptics.commit();
    haptics.error();

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('swallows rejections from devices without a haptic engine', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('no engine'));

    expect(() => haptics.selection()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the test run.
    await new Promise((resolve) => setImmediate(resolve));
  });
});
