import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics } from '../../lib/ui/haptics';
import { current, dismiss, enqueue, type DialogRequest, type PendingDialog } from './dialogQueue';

export type { DialogRequest } from './dialogQueue';

/**
 * The app's own dialog, in place of the platform alert.
 *
 * `Alert.alert` draws whatever the operating system draws: on Android a white Material box with
 * blue capitalised text, in the middle of an app that is dark, purple and lower case. It is the
 * one surface the app did not design, and it appeared at the moments that matter most — deleting
 * a task, deleting an account.
 *
 * It is called the way the platform alert was, as a function rather than as state a screen has to
 * hold, because that is what the call sites need. `confirm` resolves to what the person chose, so
 * a handler reads as one straight line instead of a callback inside an options array.
 */

// ─── The hook ───────────────────────────────────────────────────────────────────────────────────

type DialogApi = {
  /** A question. Resolves true when confirmed, false when cancelled or dismissed. */
  confirm: (request: DialogRequest & { cancelLabel?: string }) => Promise<boolean>;
  /** A statement. Resolves once it has been acknowledged. */
  alert: (request: Omit<DialogRequest, 'cancelLabel' | 'destructive'>) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used within a DialogProvider');
  return api;
}

// ─── The provider ───────────────────────────────────────────────────────────────────────────────

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<PendingDialog[]>([]);
  const nextId = useRef(0);

  const ask = useCallback((request: DialogRequest) => {
    return new Promise<boolean>((resolve) => {
      nextId.current += 1;
      setQueue((pending) => enqueue(pending, { ...request, id: nextId.current, resolve }));
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: ask,
      alert: async (request) => {
        await ask(request);
      },
    }),
    [ask]
  );

  const close = useCallback((confirmed: boolean) => {
    setQueue((pending) => dismiss(pending, confirmed));
  }, []);

  const open = current(queue);
  const hasCancel = open?.cancelLabel !== undefined;

  return (
    <DialogContext.Provider value={api}>
      {children}

      <Modal
        visible={open !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        // Android's back button answers the question the same way the cancel button does.
        onRequestClose={() => close(false)}
      >
        {open ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={styles.overlay}
          >
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

            <Animated.View
              // Keyed by id so a queued dialog animates in as a new one rather than
              // swapping its text underneath the reader.
              key={open.id}
              entering={ZoomIn.springify().damping(18).stiffness(220)}
              style={styles.card}
              accessibilityViewIsModal
              accessibilityRole="alert"
            >
              <Text style={styles.title}>{open.title}</Text>
              {open.message ? <Text style={styles.message}>{open.message}</Text> : null}

              <View style={styles.actions}>
                {hasCancel ? (
                  <TouchableOpacity
                    onPress={() => {
                      haptics.tap();
                      close(false);
                    }}
                    style={styles.cancel}
                    accessibilityRole="button"
                    accessibilityLabel={open.cancelLabel}
                  >
                    <Text style={styles.cancelText}>{open.cancelLabel}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => {
                    if (open.destructive) haptics.warning();
                    else haptics.press();
                    close(true);
                  }}
                  style={styles.confirm}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={open.confirmLabel ?? t('common.ok')}
                >
                  <LinearGradient
                    colors={open.destructive ? DESTRUCTIVE : AFFIRMATIVE}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.confirmFill}
                  >
                    <Text style={styles.confirmText}>{open.confirmLabel ?? t('common.ok')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        ) : null}
      </Modal>
    </DialogContext.Provider>
  );
};

const AFFIRMATIVE = ['#8B5CF6', '#6D28D9'] as const;
const DESTRUCTIVE = ['#F87171', '#DC2626'] as const;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 30, 46, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    // Lifts the card off the blur on Android, which does not draw the shadow below.
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.4,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 12 },
    }),
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  actions: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  cancel: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  confirm: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmFill: {
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
