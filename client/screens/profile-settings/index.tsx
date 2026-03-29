import React, { useState, useMemo, useEffect } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createFormDataFile } from '@/utils';
import { Spacing } from '@/constants/theme';
import { 
  getHomeLayoutConfig, 
  setHomeLayoutType, 
  HomeLayoutType, 
  HOME_LAYOUT_OPTIONS 
} from '@/utils/homeLayoutConfig';
import { createStyles } from './styles';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface UserProfile {
  id: number;
  username: string;
  avatar_url?: string;
}

export default function ProfileSettingsScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<HomeLayoutType>('state-driven');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载布局配置
      const config = await getHomeLayoutConfig();
      setSelectedLayout(config.layoutType);

      // 加载用户信息
      if (isAuthenticated && user?.id) {
        const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/me?user_id=${user.id}`);
        const data = await res.json();
        if (data.success && data.user) {
          setUsername(data.user.username || '');
          setAvatarUrl(data.user.avatar_url || null);
        }
      }
    } catch (e) {
      console.error('加载设置失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('提示', '需要相册权限才能选择头像');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (e) {
      console.error('选择图片失败:', e);
      Alert.alert('错误', '选择图片失败');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1] : 'jpg';
      const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      const fileData = await createFormDataFile(uri, filename, mimeType);
      
      const formData = new FormData();
      formData.append('file', fileData as any);
      formData.append('user_id', user.id.toString());

      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/avatar`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.avatar_url) {
        setAvatarUrl(data.avatar_url);
        Alert.alert('成功', '头像已更新');
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (e) {
      console.error('上传头像失败:', e);
      Alert.alert('错误', '上传头像失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 保存布局配置
      await setHomeLayoutType(selectedLayout);

      // 保存用户名（如果已登录）
      if (isAuthenticated && user?.id && username.trim()) {
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/me`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, username: username.trim() }),
        });
      }

      Alert.alert('成功', '设置已保存', [
        { text: '确定', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error('保存设置失败:', e);
      Alert.alert('错误', '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="chevron-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="h4" color={theme.textPrimary} style={styles.headerTitle}>
            个人设置
          </ThemedText>
          <View style={{ width: 20 }} />
        </View>

        {/* 头像区域 */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} activeOpacity={0.7}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome6 name="user" size={40} color={theme.primary} />
              </View>
            )}
            {saving && (
              <View style={[styles.avatarPlaceholder, { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <ThemedText variant="small" color={theme.textMuted} style={styles.avatarHint}>
            点击更换头像
          </ThemedText>
        </View>

        {/* 用户名区域 */}
        {isAuthenticated && (
          <View style={styles.usernameSection}>
            <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
              用户名
            </ThemedText>
            <View style={styles.inputContainer}>
              <FontAwesome6 name="user" size={16} color={theme.textMuted} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="请输入用户名"
                placeholderTextColor={theme.textMuted}
                maxLength={20}
              />
            </View>
          </View>
        )}

        {/* 布局选择区域 */}
        <View style={styles.layoutSection}>
          <ThemedText variant="smallMedium" color={theme.textSecondary} style={styles.sectionTitle}>
            首页布局样式
          </ThemedText>
          <View style={styles.layoutGrid}>
            {HOME_LAYOUT_OPTIONS.map((option) => {
              const isSelected = selectedLayout === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.layoutCard, isSelected && styles.layoutCardSelected]}
                  onPress={() => setSelectedLayout(option.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.layoutCardHeader}>
                    <View style={[
                      styles.layoutIconContainer, 
                      { backgroundColor: isSelected ? theme.primary + '20' : theme.backgroundTertiary }
                    ]}>
                      <FontAwesome6 
                        name={
                          option.key === 'single-column' ? 'list' :
                          option.key === 'two-column' ? 'grip' :
                          option.key === 'hero-list' ? 'star' :
                          'wand-magic-sparkles'
                        } 
                        size={16} 
                        color={isSelected ? theme.primary : theme.textMuted} 
                      />
                    </View>
                    <ThemedText variant="bodyMedium" color={isSelected ? theme.primary : theme.textPrimary} style={styles.layoutName}>
                      {option.name}
                    </ThemedText>
                    {isSelected && (
                      <View style={styles.layoutCheckmark}>
                        <FontAwesome6 name="check" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <ThemedText variant="small" color={theme.textMuted} style={styles.layoutDescription}>
                    {option.description}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 保存按钮 */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={theme.buttonPrimaryText} />
          ) : (
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>保存设置</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}
