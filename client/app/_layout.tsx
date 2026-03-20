import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { AuthProvider } from "@/contexts/AuthContext";
import { ColorSchemeProvider } from '@/hooks/useColorScheme';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

export default function RootLayout() {
  return (
    <AuthProvider>
      <ColorSchemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="auto"></StatusBar>
          <Stack screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            headerShown: false
          }}>
            <Stack.Screen name="(tabs)" options={{ title: "" }} />
            <Stack.Screen name="practice" options={{ title: "听力练习" }} />
            <Stack.Screen name="add-material" options={{ title: "添加材料" }} />
            <Stack.Screen name="admin" options={{ title: "材料管理" }} />
            <Stack.Screen name="admin-sentences" options={{ title: "句子编辑" }} />
            <Stack.Screen name="text-split" options={{ title: "文本切分" }} />
            <Stack.Screen name="timestamp-editor" options={{ title: "时间戳设置" }} />
          </Stack>
          <Toast />
        </GestureHandlerRootView>
      </ColorSchemeProvider>
    </AuthProvider>
  );
}
