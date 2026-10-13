import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, HeaderGradient, Radius, Spacing } from '@/constants/theme';
import { formatVnd } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

/** Header màu cam hồng, tự chừa vùng tai thỏ / status bar. */
export function GradientHeader({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={HeaderGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

export function HeaderPill({ label }: { label: string }) {
  return (
    <View style={styles.headerPill}>
      <Text style={styles.headerPillText}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? Colors.onPrimary : Colors.primary} />
  ) : (
    <Text style={variant === 'primary' ? styles.buttonText : styles.buttonOutlineText}>{label}</Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [{ opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={HeaderGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.button, styles.buttonOutline]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CashbackBadge({ amount }: { amount: number | null }) {
  if (amount === null) return null;
  return (
    <View style={styles.cashback}>
      <Text style={styles.cashbackText}>Hoàn ~{formatVnd(amount)}</Text>
    </View>
  );
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  cancelled: 'Đã huỷ',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const palette = {
    pending: [Colors.pendingBackground, Colors.pendingText],
    approved: [Colors.approvedBackground, Colors.approvedText],
    cancelled: [Colors.cancelledBackground, Colors.cancelledText],
  }[status];
  return (
    <View style={[styles.status, { backgroundColor: palette[0] }]}>
      <Text style={[styles.statusText, { color: palette[1] }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function ProductThumb({ uri, size = 48 }: { uri: string | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: Radius.sm };
  if (!uri) {
    return <LinearGradient colors={['#FFE1D6', '#FFD0DC']} style={box} />;
  }
  return <Image source={{ uri }} style={box} contentFit="cover" />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ alignItems: 'center', gap: Spacing.md }}>
      <Text style={styles.errorText}>{message}</Text>
      <Button label="Thử lại" variant="outline" onPress={onRetry} />
    </Card>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerTitle: {
    color: Colors.onPrimary,
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  headerPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  headerPillText: {
    color: Colors.onPrimary,
    fontWeight: '700',
    fontSize: FontSize.caption,
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  buttonText: {
    color: Colors.onPrimary,
    fontWeight: '800',
    fontSize: FontSize.bodyLarge,
  },
  buttonOutlineText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.bodyLarge,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  cashback: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.cashback,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cashbackText: {
    color: Colors.text,
    fontWeight: '800',
    fontSize: FontSize.caption,
  },
  status: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  errorText: {
    color: Colors.text,
    fontSize: FontSize.body,
    textAlign: 'center',
  },
  note: {
    backgroundColor: Colors.noteBackground,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  noteText: {
    color: Colors.noteText,
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
});
