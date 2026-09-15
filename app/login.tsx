import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { MinitoIcon } from '../src/components';
import { useAuth } from '../src/features/auth/controller/AuthContext';
import { AuthRepositoryError, type AuthErrorCode } from '../src/repositories/authRepository';

type Mode = 'signIn' | 'signUp';
type PendingAction = 'email' | 'google' | 'apple';
type LoginErrorCode = Exclude<AuthErrorCode, 'cancelled'> | 'invalid_input';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const PLACEHOLDER_COLOR = '#71717A';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, providers } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isBusy = pending !== null;

  // On success the root auth guard swaps this screen out, so no manual navigation is needed.
  const run = async (action: PendingAction, task: () => Promise<void>) => {
    setErrorCode(null);
    setNotice(null);
    setPending(action);
    try {
      await task();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const code = error instanceof AuthRepositoryError ? error.code : 'unknown';
      if (code !== 'cancelled') {
        setErrorCode(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setPending(null);
    }
  };

  const handleSubmit = () => {
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail) || password.length < MIN_PASSWORD_LENGTH) {
      setNotice(null);
      setErrorCode('invalid_input');
      return;
    }

    if (mode === 'signIn') {
      run('email', () => signInWithEmail(trimmedEmail, password));
      return;
    }

    run('email', async () => {
      const { needsEmailConfirmation } = await signUpWithEmail(trimmedEmail, password);
      if (needsEmailConfirmation) {
        setMode('signIn');
        setPassword('');
        setNotice(t('login.checkEmail'));
      }
    });
  };

  const toggleMode = () => {
    Haptics.selectionAsync();
    setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
    setErrorCode(null);
    setNotice(null);
  };

  const hasSocialProviders = providers.google || providers.apple;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-10">
          <MinitoIcon size={88} />
        </View>

        <Text className="text-textMain text-3xl font-bold text-center mb-3">{t('login.title')}</Text>
        <Text className="text-textMuted text-base text-center mb-8">{t('login.subtitle')}</Text>

        {notice && (
          <View className="bg-success/15 border border-success/40 rounded-xl p-4 mb-4">
            <Text className="text-success text-center text-sm">{notice}</Text>
          </View>
        )}

        {errorCode && (
          <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4">
            <Text className="text-red-400 text-center text-sm">{t(`login.errors.${errorCode}`)}</Text>
          </View>
        )}

        <TextInput
          className="bg-surface text-textMain rounded-xl px-4 py-4 mb-3 text-base"
          placeholder={t('login.emailPlaceholder')}
          placeholderTextColor={PLACEHOLDER_COLOR}
          accessibilityLabel={t('login.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!isBusy}
        />
        <TextInput
          className="bg-surface text-textMain rounded-xl px-4 py-4 mb-5 text-base"
          placeholder={t('login.passwordPlaceholder')}
          placeholderTextColor={PLACEHOLDER_COLOR}
          accessibilityLabel={t('login.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!isBusy}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isBusy}
          className={`bg-primary rounded-xl py-4 items-center ${isBusy ? 'opacity-60' : ''}`}
        >
          {pending === 'email' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white text-lg font-semibold">
              {mode === 'signIn' ? t('login.signIn') : t('login.signUp')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleMode} disabled={isBusy} className="mt-5 mb-2">
          <Text className="text-textMuted text-center text-sm">
            {mode === 'signIn' ? t('login.switchToSignUp') : t('login.switchToSignIn')}
          </Text>
        </TouchableOpacity>

        {hasSocialProviders && (
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-700" />
            <Text className="text-textMuted text-sm mx-4">{t('login.or')}</Text>
            <View className="flex-1 h-px bg-gray-700" />
          </View>
        )}

        {providers.google && (
          <TouchableOpacity
            onPress={() => run('google', signInWithGoogle)}
            disabled={isBusy}
            className={`bg-gray-800 border border-gray-700 rounded-xl py-4 items-center mb-3 ${isBusy ? 'opacity-60' : ''}`}
          >
            {pending === 'google' ? (
              <ActivityIndicator size="small" color="#E5E5E5" />
            ) : (
              <Text className="text-textMain text-lg font-semibold">{t('login.continueWithGoogle')}</Text>
            )}
          </TouchableOpacity>
        )}

        {providers.apple && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={{ width: '100%', height: 52 }}
            onPress={() => {
              if (!isBusy) {
                run('apple', signInWithApple);
              }
            }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
