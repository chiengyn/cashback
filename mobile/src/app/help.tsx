import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Vì sao đơn của tôi chưa hiện?',
    a: 'Đơn thường hiện sau 30–60 phút. Nếu quá 24 giờ, có thể đơn không được sàn ghi nhận vì một trong các lý do bên dưới.',
  },
  {
    q: 'Những việc làm mất hoàn tiền',
    a: '• Bấm link giới thiệu của người khác sau khi bấm “Mua ngay”.\n• Mở link trong trình duyệt của Facebook, Zalo thay vì app sàn.\n• Thêm vào giỏ rồi vài ngày sau mới thanh toán.\n• Dùng voucher mà sàn không tính hoa hồng.',
  },
  {
    q: 'Bao lâu thì tiền về ví?',
    a: 'Sau khi hết thời hạn đổi trả và sàn duyệt đơn, thường 30–60 ngày kể từ lúc nhận hàng. Mỗi đơn có ngày duyệt dự kiến trong tab Đơn hàng.',
  },
  {
    q: 'Vì sao số tiền hoàn khác số ước tính?',
    a: 'Sàn tính hoa hồng trên giá trị hàng thực trả, không tính phí vận chuyển và một số loại voucher. Số tiền cuối cùng do sàn chốt.',
  },
];

export default function HelpScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {FAQ.map(({ q, a }) => (
        <Card key={q} style={styles.card}>
          <Text style={styles.q}>{q}</Text>
          <Text style={styles.a}>{a}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { gap: Spacing.sm, padding: Spacing.lg },
  q: { color: Colors.text, fontWeight: '800', fontSize: FontSize.bodyLarge },
  a: { color: Colors.text, fontSize: FontSize.body, lineHeight: 21 },
});
