import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, View, TouchableOpacity, Text, Alert, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';

// 后端服务地址
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Stats {
  totalFiles: number;          // 句库总数
  totalSentences: number;      // 总句数
  learnedSentences: number;    // 已学句数
  totalAttempts: number;
  errorWordsCount: number;
}

interface UserProfile {
  avatar_url?: string;
  username?: string;
}

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated, logout, updateNickname } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    totalSentences: 0,
    learnedSentences: 0,
    totalAttempts: 0,
    errorWordsCount: 0,
  });
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  
  // 修改昵称相关状态
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [updatingNickname, setUpdatingNickname] = useState(false);
  const [userManageModalVisible, setUserManageModalVisible] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      // 获取用户详细信息
      if (isAuthenticated && user?.id) {
        try {
          const userRes = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/me?user_id=${user.id}`);
          const userData = await userRes.json();
          if (userData.success && userData.user) {
            setUserProfile({
              avatar_url: userData.user.avatar_url,
              username: userData.user.username,
            });
          }
        } catch (e) {
          console.log('获取用户信息失败:', e);
        }
      }

      // 从新的句库系统获取统计数据
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const data = await response.json();

      if (data.files) {
        const files = data.files;
        
        // 句库总数
        const totalFiles = files.length;
        
        // 总句数（所有句库的可学习句子数）
        const totalSentences = files.reduce(
          (sum: number, f: { ready_sentences_count: number }) => sum + (f.ready_sentences_count || 0), 0
        );
        
        // 获取学习记录统计（如果有登录）
        let learnedSentences = 0;
        let errorWordsCount = 0;
        
        if (isAuthenticated && user?.id) {
          try {
            // 获取学习记录统计
            const statsResponse = await fetch(
              `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/stats?user_id=${user.id}`
            );
            const statsData = await statsResponse.json();
            if (statsData.success) {
              learnedSentences = statsData.data?.learnedSentences || 0;
            }
            
            // 获取错题统计
            const errorResponse = await fetch(
              `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/stats?user_id=${user.id}`
            );
            const errorData = await errorResponse.json();
            if (errorData.success) {
              errorWordsCount = errorData.data?.uniqueWords || 0;
            }
          } catch (e) {
            console.log('获取学习统计失败:', e);
          }
        }

        setStats({
          totalFiles,
          totalSentences,
          learnedSentences,
          totalAttempts: 0,
          errorWordsCount,
        });
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  }, [isAuthenticated, user?.id]);

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

  // 获取用户列表
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      /**
       * 服务端文件：server/src/routes/users.ts
       * 接口：GET /api/v1/users
       * Query 参数：page?: number, limit?: number
       */
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users?page=1&limit=50`, {
        headers: {
          'X-User-Id': user?.id || '',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        Alert.alert('错误', data.error || '获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      Alert.alert('错误', '获取用户列表失败');
    } finally {
      setLoadingUsers(false);
    }
  };

  // 修改用户角色
  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      /**
       * 服务端文件：server/src/routes/users.ts
       * 接口：PUT /api/v1/users/:id/role
       * Body 参数：role: 'admin' | 'teacher' | 'student'
       */
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user?.id || '',
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();
      if (response.ok) {
        // 刷新用户列表
        fetchUsers();
        Alert.alert('成功', '角色已更新');
      } else {
        Alert.alert('错误', data.error || '更新角色失败');
      }
    } catch (error) {
      console.error('更新角色失败:', error);
      Alert.alert('错误', '更新角色失败');
    }
  };

  // 打开用户管理弹窗时加载用户列表
  useEffect(() => {
    if (userManageModalVisible && user?.role === 'admin') {
      fetchUsers();
    }
  }, [userManageModalVisible]);

  const accuracy = stats.totalSentences > 0 
    ? Math.round((stats.learnedSentences / stats.totalSentences) * 100) 
    : 0;

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 用户信息 - 点击进入个人设置 */}
        <ThemedView level="root" style={styles.header}>
          {isAuthenticated && user ? (
            <TouchableOpacity 
              style={styles.userInfo}
              onPress={() => router.push('/profile-settings')}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                {userProfile.avatar_url ? (
                  <Image source={{ uri: userProfile.avatar_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                ) : (
                  <FontAwesome6 name="user" size={24} color={theme.primary} />
                )}
              </View>
              <View style={styles.userDetails}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ThemedText variant="h3" color={theme.textPrimary}>
                    {userProfile.username || user.nickname || '用户'}
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
                </View>
                <ThemedText variant="small" color={theme.textMuted}>
                  {user.is_guest ? '游客模式' : user.phone}
                </ThemedText>
                <ThemedText variant="tiny" color={theme.textMuted} style={{ marginTop: 2 }}>
                  点击进入设置
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
            </TouchableOpacity>
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
          
          {/* 退出登录按钮（独立） */}
          {isAuthenticated && user && (
            <TouchableOpacity 
              onPress={handleLogout} 
              style={{ 
                position: 'absolute', 
                right: Spacing.lg, 
                top: Spacing.lg,
                padding: Spacing.sm,
              }}
            >
              <FontAwesome6 name="right-from-bracket" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <FontAwesome6 name="folder" size={24} color={theme.primary} style={styles.statIcon} />
            <ThemedText variant="h2" color={theme.textPrimary} style={styles.statValue}>
              {stats.totalFiles}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.statLabel}>
              句库总数
            </ThemedText>
          </View>

          <View style={[styles.statCard, styles.statCardEven]}>
            <FontAwesome6 name="circle-check" size={24} color={theme.success} style={styles.statIcon} />
            <ThemedText variant="h2" color={theme.success} style={styles.statValue}>
              {stats.learnedSentences}
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.statLabel}>
              已学习
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
              学习进度
            </ThemedText>
          </View>
        </View>

        {/* Admin Section */}
        <ThemedText variant="h4" color={theme.textPrimary} style={styles.sectionHeader}>
          管理功能
        </ThemedText>

        {/* 学习监控入口 - 仅管理者和教师可见 */}
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <TouchableOpacity 
            style={styles.adminCard}
            onPress={() => router.push('/learning-monitor')}
          >
            <View style={[styles.adminIcon, { backgroundColor: theme.success + '15' }]}>
              <FontAwesome6 name="users" size={24} color={theme.success} />
            </View>
            <View style={styles.adminContent}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                学习监控
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                查看所有学习者的学习情况和薄弱单词
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}

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
          onPress={() => router.push('/create-ai-sentence-file')}
        >
          <View style={[styles.adminIcon, { backgroundColor: theme.primary + '15' }]}>
            <FontAwesome6 name="wand-magic-sparkles" size={24} color={theme.primary} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              创建 AI 句库
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              上传 PDF 或文本文档，AI 自动配音生成句库
            </ThemedText>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.adminCard}
          onPress={() => router.push('/sentence-workshop')}
        >
          <View style={[styles.adminIcon, { backgroundColor: theme.accent + '15' }]}>
            <FontAwesome6 name="scissors" size={24} color={theme.accent} />
          </View>
          <View style={styles.adminContent}>
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>
              句库制作
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted}>
              上传视频/音频，提取文本制作句库
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

        {/* 用户管理 - 仅管理员可见 */}
        {user?.role === 'admin' && (
          <TouchableOpacity 
            style={styles.adminCard}
            onPress={() => setUserManageModalVisible(true)}
          >
            <View style={[styles.adminIcon, { backgroundColor: theme.success + '15' }]}>
              <FontAwesome6 name="users-gear" size={24} color={theme.success} />
            </View>
            <View style={styles.adminContent}>
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                用户管理
              </ThemedText>
              <ThemedText variant="small" color={theme.textMuted}>
                管理用户角色和权限
              </ThemedText>
            </View>
            <FontAwesome6 name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
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

      {/* 用户管理弹窗 - 仅管理员可用 */}
      <Modal visible={userManageModalVisible} transparent animationType="slide">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: theme.backgroundDefault,
            borderTopLeftRadius: BorderRadius.xl,
            borderTopRightRadius: BorderRadius.xl,
            maxHeight: '80%',
            paddingTop: Spacing.md,
          }}>
            {/* 弹窗标题 */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: Spacing.xl,
              paddingBottom: Spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.borderLight,
            }}>
              <ThemedText variant="h4" color={theme.textPrimary}>用户管理</ThemedText>
              <TouchableOpacity onPress={() => setUserManageModalVisible(false)}>
                <FontAwesome6 name="xmark" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {/* 用户列表 */}
            {loadingUsers ? (
              <View style={{ padding: Spacing['2xl'], alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : (
              <ScrollView style={{ paddingHorizontal: Spacing.lg }}>
                {users.map((u: any) => (
                  <View 
                    key={u.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: Spacing.lg,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.borderLight,
                    }}
                  >
                    {/* 用户信息 */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ThemedText variant="bodyMedium" color={theme.textPrimary}>
                          {u.nickname || u.username || '未设置昵称'}
                        </ThemedText>
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 8,
                          backgroundColor: 
                            u.role === 'admin' ? theme.error + '15' :
                            u.role === 'teacher' ? theme.primary + '15' :
                            theme.textMuted + '15',
                        }}>
                          <ThemedText 
                            variant="caption" 
                            color={
                              u.role === 'admin' ? theme.error :
                              u.role === 'teacher' ? theme.primary :
                              theme.textMuted
                            }
                          >
                            {u.role === 'admin' ? '管理员' :
                             u.role === 'teacher' ? '教师' : '学生'}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText variant="caption" color={theme.textMuted}>
                        {u.phone || '未绑定手机'}
                      </ThemedText>
                    </View>

                    {/* 修改角色按钮 */}
                    {u.id !== user?.id && (
                      <TouchableOpacity
                        style={{
                          paddingHorizontal: Spacing.md,
                          paddingVertical: Spacing.sm,
                          borderRadius: BorderRadius.md,
                          backgroundColor: theme.primary,
                        }}
                        onPress={() => {
                          const roles = ['student', 'teacher', 'admin'];
                          const currentIndex = roles.indexOf(u.role);
                          const nextRole = roles[(currentIndex + 1) % roles.length];
                          Alert.alert(
                            '修改角色',
                            `确定将此用户角色修改为 ${
                              nextRole === 'admin' ? '管理员' :
                              nextRole === 'teacher' ? '教师' : '学生'
                            }？`,
                            [
                              { text: '取消', style: 'cancel' },
                              { 
                                text: '确定', 
                                onPress: () => handleChangeRole(u.id, nextRole)
                              }
                            ]
                          );
                        }}
                      >
                        <ThemedText variant="smallMedium" color={theme.buttonPrimaryText}>
                          切换角色
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {users.length === 0 && (
                  <View style={{ padding: Spacing['2xl'], alignItems: 'center' }}>
                    <ThemedText variant="body" color={theme.textMuted}>暂无用户</ThemedText>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
