import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, CashbackBadge, GradientHeader, HeaderPill, ProductThumb } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatShortDate, formatVnd } from '@/lib/format';
import { extractProductLink, INVALID_LINK, PlatformName } from '@/lib/links';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';

export default function HomeScreen() {
  const { session } = useSession();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clipboardHasText, setClipboardHasText] = useState(false);
  const recent = useAsync(api.recentLinks, { refetchOnFocus: true });
  const wallet = useAsync(api.wallet, { refetchOnFocus: true });
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  function openPreview(raw: string) {
    const link = extractProductLink(raw);
    if (!link) {
      setError(INVALID_LINK);
      return;
    }
    setError(null);
    setText('');
    router.push({ pathname: '/preview', params: { url: link.url } });
  }

  // Người dùng bấm "Chia sẻ" trong app sàn và chọn app này.
  // Màn Xem trước tự tách link khỏi đoạn chữ chia sẻ và báo lỗi nếu không có link hợp lệ.
  useEffect(() => {
    if (!hasShareIntent) return;
    const shared = shareIntent.webUrl ?? shareIntent.text ?? '';
    resetShareIntent();
    router.push({ pathname: '/preview', params: { url: shared } });
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  // Mỗi lần quay lại Trang chủ thì kiểm tra clipboard.
  // hasStringAsync không đọc nội dung nên iOS không hiện hộp thoại xin quyền dán.
  useFocusEffect(
    useCallback(() => {
      Clipboard.hasStringAsync().then(setClipboardHasText).catch(() => {});
    }, []),
  );

  async function pasteFromClipboard() {
    const content = await Clipboard.getStringAsync();
    setText(content);
    openPreview(content);
  }

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="HoànTiền"
        right={session && wallet.data ? <HeaderPill label={`Ví ${formatVnd(wallet.data.available)}`} /> : null}>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={(value) => {
              setText(value);
              setError(null);
            }}
            onSubmitEditing={() => openPreview(text)}
            placeholder="Dán link sản phẩm…"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            style={styles.input}
            accessibilityLabel="Link sản phẩm"
          />
          <Pressable onPress={pasteFromClipboard} hitSlop={8} accessibilityRole="button">
            <Text style={styles.pasteText}>Dán</Text>
          </Pressable>
        </View>
      </GradientHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={recent.isLoading && !!recent.data} onRefresh={recent.reload} tintColor={Colors.primary} />}>
        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {text.trim() ? (
          <Button label="Lấy link hoàn tiền" onPress={() => openPreview(text)} />
        ) : clipboardHasText ? (
          <Pressable onPress={pasteFromClipboard} accessibilityRole="button">
            <Card style={styles.clipboardCard}>
              <Text style={styles.clipboardText}>Bạn vừa sao chép một link?</Text>
              <Text style={styles.clipboardAction}>Dán và kiểm tra</Text>
            </Card>
          </Pressable>
        ) : null}

        <View style={styles.promo}>
          <Text style={styles.promoTitle}>Hoàn tiền mọi đơn</Text>
          <Text style={styles.promoSub}>Shopee · Lazada · TikTok Shop</Text>
        </View>

        <Card style={styles.steps}>
          <Text style={styles.sectionTitle}>Cách nhận hoàn tiền</Text>
          {[
            'Trong app sàn, bấm Chia sẻ → chọn HoànTiền (hoặc sao chép link rồi dán vào đây).',
            'Xem số tiền hoàn ước tính, bấm “Mua ngay”.',
            'Đặt hàng như bình thường. Tiền về ví sau khi sàn duyệt đơn.',
          ].map((step, i) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>

        {recent.data && recent.data.length > 0 ? (
          <View style={styles.recent}>
            <Text style={styles.sectionTitle}>Link gần đây</Text>
            {recent.data.map((item) => (
              <Pressable
                key={item.clickId}
                onPress={() => router.push({ pathname: '/preview', params: { url: item.originalUrl } })}
                accessibilityRole="button">
                <Card style={styles.recentItem}>
                  <ProductThumb uri={item.imageUrl} />
                  <View style={styles.recentBody}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.meta}>
                      {PlatformName[item.platform]} · {formatShortDate(item.createdAt)}
                    </Text>
                    <CashbackBadge amount={item.estimatedCashback} />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.lg,
    gap: Spacing.sm,
  },
  input: { flex: 1, minHeight: 48, fontSize: FontSize.bodyLarge, color: Colors.text },
  pasteText: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.bodyLarge },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  errorCard: { borderWidth: 1, borderColor: Colors.danger },
  errorText: { color: Colors.danger, fontSize: FontSize.body, lineHeight: 20 },
  clipboardCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  clipboardText: { color: Colors.text, fontSize: FontSize.body, flexShrink: 1 },
  clipboardAction: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.body },
  promo: {
    backgroundColor: Colors.cashback,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  promoTitle: { color: Colors.text, fontWeight: '800', fontSize: FontSize.bodyLarge },
  promoSub: { color: Colors.text, fontSize: FontSize.caption, fontWeight: '600' },
  steps: { gap: Spacing.md },
  sectionTitle: { color: Colors.text, fontWeight: '800', fontSize: FontSize.bodyLarge },
  step: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    color: Colors.onPrimary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '800',
    overflow: 'hidden',
  },
  stepText: { flex: 1, color: Colors.text, fontSize: FontSize.body, lineHeight: 20 },
  recent: { gap: Spacing.sm },
  recentItem: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  recentBody: { flex: 1, gap: Spacing.xs },
  recentTitle: { color: Colors.text, fontWeight: '600', fontSize: FontSize.body },
  meta: { color: Colors.textSecondary, fontSize: FontSize.caption },
});
