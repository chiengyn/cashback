import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';

/** Hiện nội dung khi đã đăng nhập; nếu chưa, hiện lời mời đăng nhập. */
export function RequireLogin({ reason, children }: { reason: string; children: ReactNode }) {
  const { session, isLoading } = useSession();
  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: Spacing.xxl }} color={Colors.primary} />;
  }
  if (session) return children;
  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <Text style={styles.text}>{reason}</Text>
        <Button label="Đăng nhập" onPress={() => router.push('/login')} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: Spacing.lg },
  card: { gap: Spacing.lg, padding: Spacing.lg },
  text: { color: Colors.text, fontSize: FontSize.bodyLarge, textAlign: 'center', lineHeight: 22 },
});
