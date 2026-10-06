import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { haptics } from '../../../lib/ui/haptics';
import { DISPLAY_NAME_MAX_LENGTH } from '../../../repositories/authRepository';

type DisplayNameEditorProps = {
  initialValue: string;
  autoFocus?: boolean;
  onSave: (displayName: string) => Promise<void>;
  onClose: () => void;
  onFocus?: () => void;
};

export function DisplayNameEditor({
  initialValue,
  autoFocus = false,
  onSave,
  onClose,
  onFocus,
}: DisplayNameEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialValue && !isSaving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    setHasError(false);
    try {
      await onSave(trimmed);
      haptics.success();
    } catch {
      setIsSaving(false);
      setHasError(true);
      haptics.error();
    }
  };

  return (
    <View className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <Text className="text-textMain text-base font-semibold mb-3">{t('profile.namePrompt')}</Text>
      <TextInput
        className="bg-surface text-textMain rounded-xl px-4 py-3 text-base border border-white/10"
        placeholder={t('profile.namePlaceholder')}
        placeholderTextColor="#71717A"
        accessibilityLabel={t('profile.namePrompt')}
        value={draft}
        onChangeText={setDraft}
        onFocus={onFocus}
        autoFocus={autoFocus}
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="nickname"
        returnKeyType="done"
        onSubmitEditing={handleSave}
        editable={!isSaving}
      />
      {hasError && <Text className="text-red-400 text-sm mt-2">{t('profile.saveFailed')}</Text>}
      <View className="flex-row items-center justify-end gap-5 mt-3">
        <TouchableOpacity
          onPress={onClose}
          disabled={isSaving}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-textMuted text-sm font-medium">
            {initialValue ? t('common.cancel') : t('profile.later')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          className={`bg-primary rounded-full h-10 px-5 items-center justify-center ${
            canSave || isSaving ? '' : 'opacity-50'
          }`}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white text-sm font-semibold">{t('profile.save')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
