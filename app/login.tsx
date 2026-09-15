import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import {
  AuthRepositoryError,
  DISPLAY_NAME_MAX_LENGTH,
  type AuthErrorCode,
} from '../src/repositories/authRepository';
import { useKeepAboveKeyboard } from '../src/lib/ui/useKeepAboveKeyboard';

type Mode = 'signIn' | 'signUp';
type PendingAction = 'email' | 'google' | 'apple';
type LoginErrorCode = Exclude<AuthErrorCode, 'cancelled'> | 'invalid_input' | 'invalid_name';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const PLACEHOLDER_COLOR = '#71717A';
const INPUT_CLASS =
  'bg-surface text-textMain rounded-xl px-4 py-4 text-base border border-white/10';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, providers } =
    useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const formRef = useRef<View>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const keyboardScroll = useKeepAboveKeyboard(scrollRef, formRef);

  const isBusy = pending !== null;
  const isSignUp = mode === 'signUp';

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
    const trimmedName = displayName.trim();
    setNotice(null);

    if (isSignUp && !trimmedName) {
      setErrorCode('invalid_name');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail) || password.length < MIN_PASSWORD_LENGTH) {
      setErrorCode('invalid_input');
      return;
    }

    if (!isSignUp) {
      run('email', () => signInWithEmail(trimmedEmail, password));
      return;
    }

    run('email', async () => {
      const { needsEmailConfirmation } = await signUpWithEmail(trimmedEmail, password, trimmedName);
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
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={scrollRef}
        onScroll={keyboardScroll.onScroll}
        onLayout={keyboardScroll.onLayout}
        scrollEventThrottle={16}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <MinitoIcon size={80} color="#8B5CF6" />
        </View>

        <Text className="text-textMain text-3xl font-bold text-center mb-2">
          {t('login.title')}
        </Text>
        <Text className="text-textMuted text-base text-center mb-8">{t('login.subtitle')}</Text>

        <View
          ref={formRef}
          collapsable={false}
          className="rounded-3xl bg-white/5 border border-white/10 p-5"
        >
          {notice && (
            <View className="bg-success/15 border border-success/40 rounded-xl p-4 mb-4">
              <Text className="text-success text-center text-sm">{notice}</Text>
            </View>
          )}

          {errorCode && (
            <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4">
              <Text className="text-red-400 text-center text-sm">
                {t(`login.errors.${errorCode}`)}
              </Text>
            </View>
          )}

          {isSignUp && (
            <TextInput
              className={`${INPUT_CLASS} mb-3`}
              placeholder={t('login.namePlaceholder')}
              placeholderTextColor={PLACEHOLDER_COLOR}
              accessibilityLabel={t('login.namePlaceholder')}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="nickname"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={!isBusy}
            />
          )}
          <TextInput
            ref={emailRef}
            className={`${INPUT_CLASS} mb-3`}
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
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isBusy}
          />
          <TextInput
            ref={passwordRef}
            className={`${INPUT_CLASS} mb-5`}
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor={PLACEHOLDER_COLOR}
            accessibilityLabel={t('login.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!isBusy}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isBusy}
            accessibilityRole="button"
            className={`bg-primary rounded-xl h-14 items-center justify-center ${isBusy ? 'opacity-60' : ''}`}
          >
            {pending === 'email' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white text-lg font-semibold">
                {isSignUp ? t('login.signUp') : t('login.signIn')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleMode} disabled={isBusy} className="mt-4 py-1">
            <Text className="text-textMuted text-center text-sm">
              {isSignUp ? t('login.switchToSignIn') : t('login.switchToSignUp')}
            </Text>
          </TouchableOpacity>
        </View>

        {hasSocialProviders && (
          <>
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-white/10" />
              <Text className="text-textMuted text-sm mx-4">{t('login.or')}</Text>
              <View className="flex-1 h-px bg-white/10" />
            </View>

            {providers.google && (
              <TouchableOpacity
                onPress={() => run('google', signInWithGoogle)}
                disabled={isBusy}
                accessibilityRole="button"
                className={`bg-white/10 border border-white/20 rounded-xl h-14 items-center justify-center mb-3 ${
                  isBusy ? 'opacity-60' : ''
                }`}
              >
                {pending === 'google' ? (
                  <ActivityIndicator size="small" color="#E5E5E5" />
                ) : (
                  <Text className="text-textMain text-lg font-semibold">
                    {t('login.continueWithGoogle')}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {providers.apple && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={{ width: '100%', height: 56 }}
                onPress={() => {
                  if (!isBusy) {
                    run('apple', signInWithApple);
                  }
                }}
              />
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
