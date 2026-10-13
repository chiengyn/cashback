import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const VN_PHONE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

export default function LoginScreen() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { token } = await api.verifyOtp(normalizedPhone, code);
      await signIn({ token, phone: normalizedPhone });
      router.back();
    });
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.heading}>
          {step === 'phone' ? 'Nhập số điện thoại để nhận hoàn tiền' : `Nhập mã 6 số gửi tới ${normalizedPhone}`}
        </Text>

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
            autoFocus
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
