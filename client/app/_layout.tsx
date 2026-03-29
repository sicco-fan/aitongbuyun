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
            <Stack.Screen name="error-words" options={{ title: "错题本" }} />
            <Stack.Screen name="sentence-workshop" options={{ title: "句库制作" }} />
            <Stack.Screen name="create-sentence-file" options={{ title: "创建句库文件" }} />
            <Stack.Screen name="create-ai-sentence-file" options={{ title: "创建AI句库" }} />
            <Stack.Screen name="edit-text-content" options={{ title: "编辑文本内容" }} />
            <Stack.Screen name="edit-sentence-audio" options={{ title: "剪辑句子语音" }} />
            <Stack.Screen name="sentence-practice" options={{ title: "句库学习" }} />
            <Stack.Screen name="login" options={{ title: "登录" }} />
            <Stack.Screen name="my-files" options={{ title: "我的句库" }} />
            <Stack.Screen name="share-market" options={{ title: "分享市场" }} />
            <Stack.Screen name="my-shares" options={{ title: "我的分享" }} />
            <Stack.Screen name="courses" options={{ title: "精品课程" }} />
            <Stack.Screen name="course-lessons" options={{ title: "课时列表" }} />
            <Stack.Screen name="lesson-practice" options={{ title: "课时详情" }} />
            <Stack.Screen name="lesson-learning" options={{ title: "课程学习" }} />
            <Stack.Screen name="profile-settings" options={{ title: "个人设置" }} />
          </Stack>
          <Toast />
        </GestureHandlerRootView>
      </ColorSchemeProvider>
    </AuthProvider>
  );
}
