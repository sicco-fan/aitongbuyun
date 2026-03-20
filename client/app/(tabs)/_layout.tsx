import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export default function TabLayout() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: theme.backgroundRoot,
        borderTopColor: theme.border,
        borderTopWidth: 1,
        height: Platform.OS === 'web' ? 60 : 50 + insets.bottom,
        paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom,
      },
      tabBarActiveTintColor: theme.textPrimary,
      tabBarInactiveTintColor: theme.textMuted,
      tabBarItemStyle: {
        height: Platform.OS === 'web' ? 60 : undefined,
      },
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '学习',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="headphones" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
