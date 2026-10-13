import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, GradientHeader, Note } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { isMockApi } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function AccountScreen() {
  const { session, signOut } = useSession();

  return (
    <View style={styles.screen}>
      <GradientHeader title="Tài khoản" />
      <ScrollView contentContainerStyle={styles.content}>
        {isMockApi ? <Note>Đang dùng dữ liệu mẫu. Đặt EXPO_PUBLIC_API_URL để kết nối backend thật.</Note> : null}

        <Card style={styles.card}>
          {session ? (
            <>
              <Text style={styles.label}>Số điện thoại</Text>
              <Text style={styles.value}>{session.phone}</Text>
              <Button label="Đăng xuất" variant="outline" onPress={signOut} />
            </>
          ) : (
            <>
              <Text style={styles.value}>Bạn chưa đăng nhập</Text>
              <Button label="Đăng nhập" onPress={() => router.push('/login')} />
            </>
          )}
        </Card>

        <Card style={styles.menu}>
          <MenuItem label="Câu hỏi thường gặp" onPress={() => router.push('/help')} />
        </Card>

        <Text style={styles.version}>Phiên bản {Constants.expoConfig?.version}</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.menuItem}>
      <Text style={styles.menuText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  card: { gap: Spacing.md, padding: Spacing.lg },
  label: { color: Colors.textSecondary, fontSize: FontSize.caption },
  value: { color: Colors.text, fontSize: FontSize.bodyLarge, fontWeight: '700' },
  menu: { paddingVertical: 0 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.lg },
  menuText: { color: Colors.text, fontSize: FontSize.bodyLarge },
  chevron: { color: Colors.textSecondary, fontSize: FontSize.title },
  version: { color: Colors.textSecondary, fontSize: FontSize.caption, textAlign: 'center' },
});
