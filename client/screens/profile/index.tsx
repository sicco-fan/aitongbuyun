import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, View, TouchableOpacity, Text, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { getErrorWords } from '@/utils/learningStorage';
import { Spacing, BorderRadius } from '@/constants/theme';

// 后端服务地址
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Stats {
  totalMaterials: number;
  completedMaterials: number;
  totalSentences: number;
  completedSentences: number;
  totalAttempts: number;
  errorWordsCount: number;
}

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, logout, updateNickname } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMaterials: 0,
    completedMaterials: 0,
    totalSentences: 0,
    completedSentences: 0,
    totalAttempts: 0,
    errorWordsCount: 0,
  });
  
  // 修改昵称相关状态
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [updatingNickname, setUpdatingNickname] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/materials`);
      const data = await response.json();

      if (data.materials) {
        const materials = data.materials;
        const totalMaterials = materials.length;
        const completedMaterials = materials.filter(
          (m: { completed_count: number; sentences_count: number }) => 
            m.completed_count === m.sentences_count && m.sentences_count > 0
        ).length;
        const totalSentences = materials.reduce(
          (sum: number, m: { sentences_count: number }) => sum + m.sentences_count, 0
        );
        const completedSentences = materials.reduce(
          (sum: number, m: { completed_count: number }) => sum + m.completed_count, 0
        );

        const errorWords = await getErrorWords();

        setStats({
          totalMaterials,
          completedMaterials,
          totalSentences,
          completedSentences,
          totalAttempts: 0,
          errorWordsCount: errorWords.length,
        });
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const handleLogout = () => {
    Alert.alert(
      '退出登录',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
  };

  // 打开修改昵称弹窗
  const handleOpenNicknameModal = () => {
    setNewNickname(user?.nickname || '');
    setNicknameModalVisible(true);
  };

  // 保存昵称
  const handleSaveNickname = async () => {
    if (!newNickname.trim()) {
      Alert.alert('提示', '昵称不能为空');
      return;
    }
    
    setUpdatingNickname(true);
    const result = await updateNickname(newNickname.trim());
    setUpdatingNickname(false);
    
    if (result.success) {
      setNicknameModalVisible(false);
      Alert.alert('成功', '昵称已更新');
    } else {
      Alert.alert('错误', result.error || '更新失败');
    }
  };

  const accuracy = stats.totalSentences > 0 
    ? Math.round((stats.completedSentences / stats.totalSentences) * 100) 
    : 0;

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 用户信息 */}
        <ThemedView level="root" style={styles.header}>
          {isAuthenticated && user ? (
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <FontAwesome6 name="user" size={24} color={theme.primary} />
              </View>
              <View style={styles.userDetails}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText variant="h3" color={theme.textPrimary}>
                    {user.nickname || '用户'}
                  </ThemedText>
                  {user.role === 'admin' && (
                    <View style={{ 
                      backgroundColor: theme.accent + '20', 
                      paddingHorizontal: 8, 
                      paddingVertical: 2, 
                      borderRadius: 4 
                    }}>
                      <ThemedText variant="tiny" color={theme.accent}>管理员</ThemedText>
                    </View>
                  )}
                  <TouchableOpacity onPress={handleOpenNicknameModal} style={{ marginLeft: 4 }}>
                    <FontAwesome6 name="pen" size={12} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
                <ThemedText variant="small" color={theme.textMuted}>
                  {user.is_guest ? '游客模式' : user.phone}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <FontAwesome6 name="right-from-bracket" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.loginPrompt}
              onPress={() => router.push('/login')}
            >
              <View style={styles.avatar}>
                <FontAwesome6 name="user" size={24} color={theme.textMuted} />
              </View>
              <View style={styles.userDetails}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                  点击登录
                </ThemedText>
                <ThemedText variant="small" color={theme.textMuted}>
                  登录后同步学习进度
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <FontAwesome6 name="folder" size={24} color={theme.primary} style={styles.statIcon} />
            <ThemedText variant="h2" color={theme.textPrimary} style={styles.statValue}>
              {stats.totalMaterials}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.statLabel}>
              学习材料
            </ThemedText>
          </View>

          <View style={[styles.statCard, styles.statCardEven]}>
            <FontAwesome6 name="circle-check" size={24} color={theme.success} style={styles.statIcon} />
            <ThemedText variant="h2" color={theme.success} style={styles.statValue}>
              {stats.completedMaterials}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.statLabel}>
              已完成
            </ThemedText>
          </View>

          <View style={styles.statCard}>
            <FontAwesome6 name="list" size={24} color={theme.accent} style={styles.statIcon} />
            <ThemedText variant="h2" color={theme.textPrimary} style={styles.statValue}>
              {stats.totalSentences}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.statLabel}>
              总句数
            </ThemedText>
          </View>

          <View style={[styles.statCard, styles.statCardEven]}>
            <FontAwesome6 name="percent" size={24} color={theme.primary} style={styles.statIcon} />
            <ThemedText variant="h2" color={theme.primary} style={styles.statValue}>
              {accuracy}%
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.statLabel}>
              完成率
            </ThemedText>
          </View>
        </View>

        {/* Admin Section */}
        <ThemedText variant="h4" color={theme.textPrimary} style={styles.sectionHeader}>
          管理功能
        </ThemedText>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/my-files')}
        >
          <View style={[styles.adminIcon, { backgroundColor: theme.primary + '15' }]}>
            <FontAwesome6 name="folder" size={24} color={theme.primary} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              我的句库
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              管理您创建的句库，分享给其他用户
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/share-market')}
        >
          <View style={[styles.adminIcon, { backgroundColor: theme.accent + '15' }]}>
            <FontAwesome6 name="store" size={24} color={theme.accent} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              分享市场
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              发现优质句库，下载学习
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/sentence-workshop')}
        >
          <View style={[styles.adminIcon, { backgroundColor: theme.accent + '15' }]}>
            <FontAwesome6 name="wand-magic-sparkles" size={24} color={theme.accent} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              句库制作
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              上传素材、提取文本、制作语音片段
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/error-words')}
        >
          <View style={[styles.adminIcon, { backgroundColor: theme.error + '15' }]}>
            <FontAwesome6 name="book" size={24} color={theme.error} />
          </View>
          <View style={styles.adminContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                错题本
              </ThemedText>
              {stats.errorWordsCount > 0 && (
                <View style={{ 
                  backgroundColor: theme.error, 
                  paddingHorizontal: 8, 
                  paddingVertical: 2, 
                  borderRadius: 10,
                  minWidth: 20,
                  alignItems: 'center',
                }}>
                  <ThemedText variant="tiny" color={theme.buttonPrimaryText}>
                    {stats.errorWordsCount}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText variant="small" color={theme.textMuted}>
              查看易错单词，针对性复习
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/letter-training')}
        >
          <View style={styles.adminIcon}>
            <FontAwesome6 name="microphone" size={24} color={theme.success} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              字母发音采集
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              录制字母发音，优化语音识别准确率
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/admin')}
        >
          <View style={styles.adminIcon}>
            <FontAwesome6 name="gear" size={24} color={theme.primary} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              材料管理
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              编辑句子、修正识别结果、手动切分
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      {/* 修改昵称弹窗 */}
      <Modal visible={nicknameModalVisible} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: theme.backgroundDefault,
            borderRadius: BorderRadius.lg,
            padding: Spacing.xl,
            width: '85%',
            maxWidth: 400,
          }}>
            <ThemedText variant="h4" color={theme.textPrimary} style={{ marginBottom: Spacing.lg, textAlign: 'center' }}>
              修改昵称
            </ThemedText>
            <TextInput
              style={{
                backgroundColor: theme.backgroundTertiary,
                borderRadius: BorderRadius.md,
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.md,
                fontSize: 16,
                color: theme.textPrimary,
                marginBottom: Spacing.md,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
              value={newNickname}
              onChangeText={setNewNickname}
              placeholder="请输入昵称"
              placeholderTextColor={theme.textMuted}
              maxLength={20}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md }}>
              <TouchableOpacity 
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.md,
                  alignItems: 'center',
                  backgroundColor: theme.backgroundTertiary,
                }}
                onPress={() => setNicknameModalVisible(false)}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{
                  flex: 1,
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.md,
                  alignItems: 'center',
                  backgroundColor: theme.primary,
                }}
                onPress={handleSaveNickname}
                disabled={updatingNickname}
              >
                {updatingNickname ? (
                  <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.buttonPrimaryText }}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
