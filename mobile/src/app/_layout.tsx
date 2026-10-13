import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { SessionProvider } from '@/lib/session';

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: Colors.primary, background: Colors.background, card: Colors.card, text: Colors.text },
};

export default function RootLayout() {
  return (
    // ShareIntentProvider phải nằm ngoài cùng (theo hướng dẫn của expo-share-intent).
    <ShareIntentProvider>
      <SessionProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerTintColor: Colors.primary, headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="preview" options={{ title: 'Xem trước' }} />
            <Stack.Screen name="login" options={{ title: 'Đăng nhập', presentation: 'modal' }} />
            <Stack.Screen name="withdraw" options={{ title: 'Rút tiền', presentation: 'modal' }} />
            <Stack.Screen name="help" options={{ title: 'Câu hỏi thường gặp' }} />
          </Stack>
        </ThemeProvider>
      </SessionProvider>
    </ShareIntentProvider>
  );
}
