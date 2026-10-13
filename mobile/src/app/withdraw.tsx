import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Note } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { formatVnd } from '@/lib/format';

export default function WithdrawScreen() {
  const { session } = useSession();
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountValue = Number(amount.replace(/\D/g, '')) || 0;
  const isComplete = amountValue > 0 && bankName.trim() && accountNumber.trim() && accountName.trim();

  async function submit() {
    setIsBusy(true);
    setError(null);
    try {
      await api.requestWithdrawal({
        amount: amountValue,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim().toUpperCase(),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gửi được yêu cầu, bạn thử lại nhé.');
    } finally {
      setIsBusy(false);
    }
  }

  // Tài khoản Apple phải thêm số điện thoại trước (một số điện thoại một tài khoản nhận tiền).
  if (session && !session.phone) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Note>Bạn cần thêm số điện thoại vào tài khoản trước khi rút tiền.</Note>
        <Button label="Thêm số điện thoại" onPress={() => router.replace({ pathname: '/login', params: { mode: 'link' } })} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Số tiền (₫)">
          <TextInput
            value={amountValue ? formatVnd(amountValue).replace('₫', '') : ''}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="100.000"
            placeholderTextColor={Colors.textSecondary}
            style={styles.input}
            accessibilityLabel="Số tiền muốn rút"
          />
        </Field>
        <Field label="Ngân hàng">
          <TextInput value={bankName} onChangeText={setBankName} placeholder="Vietcombank" placeholderTextColor={Colors.textSecondary} style={styles.input} accessibilityLabel="Ngân hàng" />
        </Field>
        <Field label="Số tài khoản">
          <TextInput value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholderTextColor={Colors.textSecondary} style={styles.input} accessibilityLabel="Số tài khoản" />
        </Field>
        <Field label="Tên chủ tài khoản">
          <TextInput value={accountName} onChangeText={setAccountName} autoCapitalize="characters" placeholder="NGUYEN VAN A" placeholderTextColor={Colors.textSecondary} style={styles.input} accessibilityLabel="Tên chủ tài khoản" />
        </Field>

        <Note>Lần rút đầu tiên cần được duyệt thủ công. Tên chủ tài khoản phải trùng với tên đăng ký ngân hàng.</Note>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Gửi yêu cầu rút tiền" onPress={submit} loading={isBusy} disabled={!isComplete} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { color: Colors.textSecondary, fontSize: FontSize.body, fontWeight: '600' },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
    fontSize: FontSize.bodyLarge,
    color: Colors.text,
  },
  error: { color: Colors.danger, fontSize: FontSize.body },
});
