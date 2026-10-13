import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, GradientHeader, Note } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { api, isMockApi } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function AccountScreen() {
  const { session, signOut } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);

  // App Store và Google Play yêu cầu xoá tài khoản được ngay trong app.
  function confirmDelete() {
    Alert.alert(
      'Xoá tài khoản?',
      'Tài khoản và số dư chưa rút sẽ bị xoá vĩnh viễn, không khôi phục được. Đơn đang chờ duyệt sẽ không được hoàn tiền.',
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá tài khoản', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      await signOut();
      Alert.alert('Đã xoá tài khoản', 'Cảm ơn bạn đã dùng HoànTiền.');
    } catch (e) {
      Alert.alert('Chưa xoá được tài khoản', e instanceof Error ? e.message : 'Bạn thử lại sau ít phút.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <GradientHeader title="Tài khoản" />
      <ScrollView contentContainerStyle={styles.content}>
        {isMockApi ? <Note>Đang dùng dữ liệu mẫu. Đặt EXPO_PUBLIC_API_URL để kết nối backend thật.</Note> : null}

        <Card style={styles.card}>
          {session ? (
            <>
              <Text style={styles.label}>{session.phone ? 'Số điện thoại' : 'Đăng nhập bằng'}</Text>
              <Text style={styles.value}>{session.phone ?? 'Apple'}</Text>
              {session.phone ? null : (
                <>
                  <Text style={styles.hint}>Thêm số điện thoại để rút tiền hoàn về ngân hàng.</Text>
                  <Button label="Thêm số điện thoại" onPress={() => router.push({ pathname: '/login', params: { mode: 'link' } })} />
                </>
              )}
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
          {session ? <MenuItem label={isDeleting ? 'Đang xoá tài khoản…' : 'Xoá tài khoản'} danger onPress={confirmDelete} disabled={isDeleting} /> : null}
        </Card>

        <Text style={styles.version}>Phiên bản {Constants.expoConfig?.version}</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={styles.menuItem}>
      <Text style={[styles.menuText, danger && styles.danger]}>{label}</Text>
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
  hint: { color: Colors.textSecondary, fontSize: FontSize.body },
  menu: { paddingVertical: 0 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.lg },
  menuText: { color: Colors.text, fontSize: FontSize.bodyLarge },
  danger: { color: Colors.danger },
  chevron: { color: Colors.textSecondary, fontSize: FontSize.title },
  version: { color: Colors.textSecondary, fontSize: FontSize.caption, textAlign: 'center' },
});
