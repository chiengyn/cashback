import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RequireLogin } from '@/components/require-login';
import { Button, Card, ErrorState, GradientHeader } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatShortDate, formatVnd } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';

export default function WalletScreen() {
  const { session } = useSession();
  if (session) return <WalletContent />;
  return (
    <View style={styles.screen}>
      <GradientHeader title="Ví của tôi" />
      <RequireLogin reason="Đăng nhập để xem số dư và rút tiền hoàn.">{null}</RequireLogin>
    </View>
  );
}

function WalletContent() {
  const { data: wallet, error, isLoading, reload } = useAsync(api.wallet, { refetchOnFocus: true });

  const canWithdraw = !!wallet && wallet.available >= wallet.minWithdrawal;

  return (
    <View style={styles.screen}>
      <GradientHeader title="Ví của tôi">
        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>Có thể rút</Text>
          <Text style={styles.balanceAmount}>{wallet ? formatVnd(wallet.available) : '—'}</Text>
          <Text style={styles.balanceLabel}>Đang chờ duyệt: {wallet ? formatVnd(wallet.pending) : '—'}</Text>
        </View>
      </GradientHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading && !!wallet} onRefresh={reload} tintColor={Colors.primary} />}>
        {error ? <ErrorState message={error} onRetry={reload} /> : null}

        {wallet ? (
          <>
            <Button label="Rút về ngân hàng" onPress={() => router.push('/withdraw')} disabled={!canWithdraw} />
            <Text style={styles.hint}>
              Tối thiểu {formatVnd(wallet.minWithdrawal)} · xử lý trong 3 ngày làm việc
            </Text>

            <Text style={styles.sectionTitle}>Lịch sử</Text>
            <Card style={styles.entries}>
              {wallet.entries.length === 0 ? <Text style={styles.hint}>Chưa có giao dịch nào.</Text> : null}
              {wallet.entries.map((entry, i) => (
                <View key={entry.id} style={[styles.entry, i > 0 && styles.entryDivider]}>
                  <View style={styles.entryBody}>
                    <Text style={styles.entryLabel}>{entry.label}</Text>
                    <Text style={styles.hint}>{formatShortDate(entry.createdAt)}</Text>
                  </View>
                  <Text style={[styles.entryAmount, entry.amount > 0 && styles.entryPlus]}>
                    {entry.amount > 0 ? '+' : '−'}
                    {formatVnd(Math.abs(entry.amount))}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  balance: { gap: 2 },
  balanceLabel: { color: Colors.onPrimary, opacity: 0.9, fontSize: FontSize.body },
  balanceAmount: { color: Colors.onPrimary, fontSize: FontSize.balance, fontWeight: '800', fontVariant: ['tabular-nums'] },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  hint: { color: Colors.textSecondary, fontSize: FontSize.caption },
  sectionTitle: { color: Colors.text, fontWeight: '800', fontSize: FontSize.bodyLarge, marginTop: Spacing.sm },
  entries: { paddingVertical: Spacing.xs },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md },
  entryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  entryBody: { flex: 1, gap: 2 },
  entryLabel: { color: Colors.text, fontSize: FontSize.body },
  entryAmount: { color: Colors.text, fontWeight: '800', fontSize: FontSize.body, fontVariant: ['tabular-nums'] },
  entryPlus: { color: Colors.money },
});
