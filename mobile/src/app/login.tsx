import * as AppleAuthentication from 'expo-apple-authentication';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const VN_PHONE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

/**
 * Đăng nhập bằng SĐT + OTP, hoặc Sign in with Apple trên iOS.
 * `?mode=link`: tài khoản Apple đã đăng nhập thêm số điện thoại (bắt buộc trước khi rút tiền).
 */
export default function LoginScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isLink = mode === 'link';
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || isLink) return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, [isLink]);

  const normalizedPhone = phone.replace(/\s/g, '');

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra, bạn thử lại nhé.');
    } finally {
      setIsBusy(false);
    }
  }

  function sendOtp() {
    if (!VN_PHONE.test(normalizedPhone)) {
      setError('Số điện thoại chưa đúng. Ví dụ: 0912345678.');
      return;
    }
    run(async () => {
      await api.sendOtp(normalizedPhone);
      setStep('otp');
    });
  }

  function verify() {
    run(async () => {
      // Khi isLink, api gửi kèm token hiện tại nên backend gắn số vào tài khoản Apple đang đăng nhập.
      const result = await api.verifyOtp(normalizedPhone, code);
      await signIn(result);
      router.back();
    });
  }

  async function signInWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync();
      if (!credential.identityToken) throw new Error('Apple không trả về thông tin đăng nhập. Bạn thử lại nhé.');
      await run(async () => {
        const result = await api.signInWithApple(credential.identityToken!, credential.authorizationCode);
        await signIn(result);
        router.back();
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError(e instanceof Error ? e.message : 'Đăng nhập Apple không thành công. Bạn thử lại nhé.');
    }
  }

  const heading =
    step === 'otp'
      ? `Nhập mã 6 số gửi tới ${normalizedPhone}`
      : isLink
        ? 'Thêm số điện thoại để rút tiền hoàn'
        : 'Đăng nhập để nhận hoàn tiền';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isLink ? 'Thêm số điện thoại' : 'Đăng nhập' }} />
      <View style={styles.content}>
        <Text style={styles.heading}>{heading}</Text>

        {step === 'phone' && appleAvailable ? (
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={Radius.md}
              style={styles.appleButton}
              onPress={signInWithApple}
            />
            <Text style={styles.divider}>hoặc dùng số điện thoại</Text>
          </>
        ) : null}

        {step === 'phone' ? (
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="0912 345 678"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            style={styles.input}
            accessibilityLabel="Số điện thoại"
          />
        ) : (
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            style={[styles.input, styles.otp]}
            accessibilityLabel="Mã OTP"
            autoFocus
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 'phone' ? (
          <Button label="Gửi mã" onPress={sendOtp} loading={isBusy} />
        ) : (
          <>
            <Button label="Xác nhận" onPress={verify} loading={isBusy} disabled={code.length !== 6} />
            <Button label="Đổi số điện thoại" variant="outline" onPress={() => setStep('phone')} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  heading: { color: Colors.text, fontSize: FontSize.title, fontWeight: '800', lineHeight: 28 },
  appleButton: { height: 48, width: '100%' },
  divider: { color: Colors.textSecondary, fontSize: FontSize.body, textAlign: 'center' },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
    fontSize: FontSize.title,
    color: Colors.text,
  },
  otp: { letterSpacing: 8, textAlign: 'center' },
  error: { color: Colors.danger, fontSize: FontSize.body },
});
