import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';
import { haptics } from '../../../lib/ui/haptics';
import { feedbackRepository, type FeedbackScore } from '../../../repositories/feedbackRepository';

/**
 * The closing question of a finished session: did the plan fit?
 *
 * One tap, four plain answers, no follow-up. The scores feed `tasks.feedback_score`, which is how
 * a prompt version is judged by the people using it rather than by its own logs.
 */

const OPTIONS: { score: FeedbackScore; labelKey: string }[] = [
  { score: 'helpful', labelKey: 'feedback.helpful' },
  { score: 'too_large', labelKey: 'feedback.tooLarge' },
  { score: 'too_small', labelKey: 'feedback.tooSmall' },
  { score: 'wrong_tone', labelKey: 'feedback.wrongTone' },
];

type BreakdownFeedbackProps = {
  /** Tracing id of the breakdown request. Without one there is no row to score. */
  requestId?: string;
};

export function BreakdownFeedback({ requestId }: BreakdownFeedbackProps) {
  const { t } = useTranslation();
  const [answered, setAnswered] = useState(false);

  // Offline plans and sessions resumed from history never had a request of their own.
  if (!requestId) return null;

  const handlePick = (score: FeedbackScore) => {
    haptics.selection();
    // The thank-you is immediate and unconditional. A score is telemetry, so a failed write is
    // logged rather than shown: asking someone to retry their own feedback, at the moment they
    // just finished something hard, would cost them more than the data point is worth.
    setAnswered(true);
    feedbackRepository.submit(requestId, score).catch((error) => {
      console.warn('Failed to submit breakdown feedback:', error);
    });
  };

  return (
    <Animated.View entering={FadeIn.delay(1100).duration(400)} className="items-center px-6">
      {answered ? (
        <Text className="text-textMuted text-sm">{t('feedback.thanks')}</Text>
      ) : (
        <>
          <Text className="text-textMuted text-sm mb-3">{t('feedback.question')}</Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.score}
                onPress={() => handlePick(option.score)}
                accessibilityRole="button"
                activeOpacity={0.7}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
              >
                <Text className="text-textMuted text-xs">{t(option.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}
