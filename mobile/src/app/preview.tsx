import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, ErrorState, Note } from '@/components/ui';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatVnd } from '@/lib/format';
import { extractProductLink, INVALID_LINK, PlatformName } from '@/lib/links';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';

export default function PreviewScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const createLink = useCallback(async () => {
    const link = extractProductLink(url ?? '');
    if (!link) throw new Error(INVALID_LINK);
    return api.createLink(link.url);
  }, [url]);
  const { data: preview, error, isLoading, reload } = useAsync(createLink);
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  async function buyNow() {
    if (!preview) return;
    // Không gắn được người dùng thì không trả được tiền hoàn, nên bắt đăng nhập trước khi sang sàn.
    if (!session) {
      router.push('/login');
      return;
    }
    setIsOpening(true);
    setOpenError(null);
    try {
      // Mở thẳng link affiliate (không đi qua /r/{click_id}) để iOS/Android mở app sàn bằng universal link.
      const { affiliateUrl } = await api.openClick(preview.clickId);
      await Linking.openURL(affiliateUrl);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'Không mở được trang sản phẩm, bạn thử lại nhé.');
    } finally {
      setIsOpening(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Đang tạo link hoàn tiền…</Text>
      </View>
    );
  }

  if (error || !preview) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <ErrorState message={error ?? 'Không tạo được link.'} onRetry={reload} />
        </View>
      </View>
    );
  }

  const { product, estimatedCashback, platform } = preview;
  const platformName = PlatformName[platform];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <LinearGradient colors={['#FFE1D6', '#FFD0DC']} style={styles.image} />
        )}

        <View style={styles.titleBlock}>
          <View style={styles.platform}>
            <Text style={styles.platformText}>{platformName}</Text>
          </View>
          <Text style={styles.title}>{product.title}</Text>
          {product.price !== null ? <Text style={styles.price}>{formatVnd(product.price)}</Text> : null}
        </View>

        {estimatedCashback !== null ? (
          <Card style={styles.cashbackCard}>
            <Text style={styles.cashbackLabel}>Hoàn ước tính</Text>
            <Text style={styles.cashbackAmount}>~{formatVnd(estimatedCashback)}</Text>
            <Text style={styles.cashbackHint}>Số tiền chính xác do sàn chốt sau khi đơn được duyệt.</Text>
          </Card>
        ) : (
          <Card>
            <Text style={styles.cashbackHint}>Sản phẩm này chưa có tỉ lệ hoàn tiền ước tính. Đơn vẫn được ghi nhận nếu sàn trả hoa hồng.</Text>
          </Card>
        )}

        <Note>
          Để không mất hoàn tiền: đặt hàng ngay trong lần mở này, không bấm link giới thiệu khác trước khi thanh toán.
        </Note>

        {openError ? <Text style={styles.errorText}>{openError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button
          label={session ? `Mua ngay trên ${platformName}` : 'Đăng nhập để nhận hoàn tiền'}
          onPress={buyNow}
          loading={isOpening}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.body },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg },
  titleBlock: { gap: Spacing.sm },
  platform: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 2 },
  platformText: { color: Colors.textSecondary, fontSize: FontSize.caption, fontWeight: '700' },
  title: { color: Colors.text, fontSize: FontSize.bodyLarge, fontWeight: '600', lineHeight: 22 },
  price: { color: Colors.primary, fontSize: FontSize.price, fontWeight: '800' },
  cashbackCard: { gap: Spacing.xs, borderWidth: 2, borderColor: Colors.cashback },
  cashbackLabel: { color: Colors.textSecondary, fontSize: FontSize.body },
  cashbackAmount: { color: Colors.primary, fontSize: FontSize.balance, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cashbackHint: { color: Colors.textSecondary, fontSize: FontSize.caption, lineHeight: 18 },
  errorText: { color: Colors.danger, fontSize: FontSize.body },
  footer: {
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
