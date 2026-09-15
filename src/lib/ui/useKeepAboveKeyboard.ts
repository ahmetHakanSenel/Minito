import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from 'react-native';

const VISIBILITY_MARGIN = 16;

/**
 * Scrolls just enough to keep `targetRef` above the keyboard. It re-checks on ScrollView
 * layout because KeyboardAvoidingView shrinks the viewport only after the keyboard event.
 */
export function useKeepAboveKeyboard(
  scrollRef: RefObject<ScrollView | null>,
  targetRef: RefObject<View | null>
) {
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  const ensureTargetVisible = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      return;
    }
    targetRef.current?.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + VISIBILITY_MARGIN - top;
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: scrollOffset.current + overlap, animated: true });
      }
    });
  }, [scrollRef, targetRef]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      ensureTargetVisible();
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [ensureTargetVisible]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { onScroll, onLayout: ensureTargetVisible };
}
