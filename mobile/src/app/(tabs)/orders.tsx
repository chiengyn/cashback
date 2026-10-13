import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { RequireLogin } from '@/components/require-login';
import { Button, Card, ErrorState, GradientHeader, ProductThumb, StatusPill } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatShortDate, formatVnd } from '@/lib/format';
import { PlatformName } from '@/lib/links';
import type { Order, OrderStatus } from '@/lib/types';
import { useAsync } from '@/lib/use-async';

const TABS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Chờ duyệt' },
  { status: 'approved', label: 'Đã duyệt' },
  { status: 'cancelled', label: 'Đã huỷ' },
];

const EMPTY_TEXT: Record<OrderStatus, string> = {
  pending: 'Chưa có đơn chờ duyệt. Đơn thường hiện ở đây sau 30–60 phút kể từ lúc đặt.',
  approved: 'Chưa có đơn nào được duyệt.',
  cancelled: 'Không có đơn bị huỷ.',
};

export default function OrdersScreen() {
  return (
    <View style={styles.screen}>
      <GradientHeader title="Đơn hàng" />
      <RequireLogin reason="Đăng nhập để xem các đơn được hoàn tiền.">
        <OrderList />
      </RequireLogin>
    </View>
  );
}

function OrderList() {
  const [tab, setTab] = useState<OrderStatus>('pending');
  const { data, error, isLoading, reload } = useAsync(api.orders, { refetchOnFocus: true });

  const orders = (data ?? []).filter((o) => o.status === tab);
  const count = (status: OrderStatus) => (data ?? []).filter((o) => o.status === status).length;

  return (
    <View style={styles.screen}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map(({ status, label }) => {
          const active = status === tab;
          return (
            <Pressable
              key={status}
              onPress={() => setTab(status)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {label} ({count(status)})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={styles.list}>
          <ErrorState message={error} onRetry={reload} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={Colors.primary} />}
          renderItem={({ item }) => <OrderRow order={item} />}
          ListEmptyComponent={isLoading ? null : <Text style={styles.empty}>{EMPTY_TEXT[tab]}</Text>}
          ListFooterComponent={
            <Button label="Đơn của tôi chưa hiện?" variant="outline" onPress={() => router.push('/help')} style={styles.help} />
          }
        />
      )}
    </View>
  );
}

function OrderRow({ order }: { order: Order }) {
  const detail =
    order.status === 'pending' && order.expectedApprovalAt
      ? `Đặt ${formatShortDate(order.orderedAt)} · duyệt ~${formatShortDate(order.expectedApprovalAt)}`
      : `Đặt ${formatShortDate(order.orderedAt)}`;
  return (
    <Card style={styles.row}>
      <ProductThumb uri={order.imageUrl} />
      <View style={styles.rowBody}>
        <Text style={styles.title} numberOfLines={1}>{order.title}</Text>
        <Text style={styles.meta}>{PlatformName[order.platform]} · {detail}</Text>
        <StatusPill status={order.status} />
      </View>
      <Text style={[styles.amount, order.status === 'cancelled' && styles.amountCancelled]}>
        {formatVnd(order.cashback)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  tabs: { flexDirection: 'row', backgroundColor: Colors.card, paddingHorizontal: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.body },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowBody: { flex: 1, gap: Spacing.xs },
  title: { color: Colors.text, fontWeight: '600', fontSize: FontSize.body },
  meta: { color: Colors.textSecondary, fontSize: FontSize.caption },
  amount: { color: Colors.text, fontWeight: '800', fontSize: FontSize.body, fontVariant: ['tabular-nums'] },
  amountCancelled: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  empty: { color: Colors.textSecondary, textAlign: 'center', fontSize: FontSize.body, lineHeight: 20, paddingVertical: Spacing.xl },
  help: { marginTop: Spacing.md },
});
