import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Text,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing } from '@/constants/theme';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface SharedFile {
  id: number;
  sentence_file_id: number;
  shared_by: string;
  title: string;
  description: string;
  download_count: number;
  created_at: string;
  sharer_nickname?: string;
}

interface SentenceItem {
  id: number;
  sentence_index: number;
  text: string;
  start_time: number | null;
  end_time: number | null;
}

interface FileDetail {
  id: number;
  title: string;
  description: string;
  original_duration: number;
  items: SentenceItem[];
}

export default function ShareMarketScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [shares, setShares] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // 详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedShare, setSelectedShare] = useState<SharedFile | null>(null);
  const [fileDetail, setFileDetail] = useState<FileDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());

  const fetchShares = useCallback(async (pageNum: number = 1, search: string = '') => {
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      });
      
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/list?${params}`
      );
      const result = await response.json();
      
      if (result.success) {
        const filtered = search
          ? result.shares.filter((s: SharedFile) => 
              s.title.toLowerCase().includes(search.toLowerCase())
            )
          : result.shares;
        
        if (pageNum === 1) {
          setShares(filtered);
        } else {
          setShares(prev => [...prev, ...filtered]);
        }
        
        setHasMore(result.shares.length === 20);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('获取分享列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchShares(1, searchText);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchShares(1, searchText);
  };

  const handleSearch = () => {
    setLoading(true);
    fetchShares(1, searchText);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchShares(page + 1, searchText);
    }
  };

  // 查看详情
  const handleViewDetail = async (share: SharedFile) => {
    setSelectedShare(share);
    setDetailModalVisible(true);
    setLoadingDetail(true);
    
    try {
      // 获取句子列表
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${share.sentence_file_id}`
      );
      const result = await response.json();
      
      if (result.success) {
        setFileDetail(result);
      }
    } catch (error) {
      console.error('获取详情失败:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 下载句库
  const handleDownload = async (share: SharedFile) => {
    if (!isAuthenticated || !user?.id) {
      Alert.alert('提示', '请先登录后再下载');
      return;
    }
    
    setDownloading(true);
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/share/download/${share.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setDownloadedIds(prev => new Set(prev).add(share.id));
        Alert.alert('成功', '句库已保存到您的账户，可在"我的句库"中查看');
      } else {
        Alert.alert('错误', result.error || '下载失败');
      }
    } catch (error) {
      console.error('下载失败:', error);
      Alert.alert('错误', '网络错误，请稍后重试');
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 50) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Header */}
        <ThemedView level="root" style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary} style={styles.headerTitle}>
              分享市场
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/my-shares')}>
              <FontAwesome6 name="share-nodes" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ThemedText variant="body" color={theme.textMuted} style={styles.subtitle}>
            发现优质句库，助力学习进步
          </ThemedText>
        </ThemedView>

        {/* Search */}
        <View style={styles.searchContainer}>
          <FontAwesome6 name="magnifying-glass" size={16} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索句库..."
            placeholderTextColor={theme.textMuted}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); fetchShares(1, ''); }}>
              <FontAwesome6 name="xmark" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Empty State */}
        {shares.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="store" size={32} color={theme.textMuted} />
            </View>
            <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.emptyText}>
              暂无分享内容
            </ThemedText>
            <ThemedText variant="small" color={theme.textMuted} style={styles.emptySubtext}>
              成为第一个分享句库的人吧
            </ThemedText>
          </View>
        ) : (
          /* Share List */
          shares.map((share) => (
            <TouchableOpacity
              key={share.id}
              style={styles.shareCard}
              onPress={() => handleViewDetail(share)}
              activeOpacity={0.7}
            >
              <View style={styles.shareHeader}>
                <View style={styles.shareIconContainer}>
                  <FontAwesome6 name="book-open" size={20} color={theme.accent} />
                </View>
                <View style={styles.shareInfo}>
                  <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.shareTitle}>
                    {share.title}
                  </ThemedText>
                  <View style={styles.shareMeta}>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="user" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {share.sharer_nickname || '匿名用户'}
                      </ThemedText>
                    </View>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="calendar" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {formatDate(share.created_at)}
                      </ThemedText>
                    </View>
                    <View style={styles.metaTag}>
                      <FontAwesome6 name="download" size={10} color={theme.textMuted} />
                      <ThemedText variant="tiny" color={theme.textMuted}>
                        {share.download_count} 次
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
              
              {share.description && (
                <ThemedText variant="small" color={theme.textSecondary} style={styles.shareDescription} numberOfLines={2}>
                  {share.description}
                </ThemedText>
              )}
              
              <View style={styles.shareFooter}>
                <View style={styles.downloadCount}>
                  <FontAwesome6 name="circle-info" size={12} color={theme.textMuted} />
                  <ThemedText variant="tiny" color={theme.textMuted}>
                    点击查看详情
                  </ThemedText>
                </View>
                
                {downloadedIds.has(share.id) ? (
                  <View style={[styles.downloadBtn, { backgroundColor: theme.success + '20' }]}>
                    <FontAwesome6 name="check" size={14} color={theme.success} />
                    <Text style={[styles.downloadBtnText, { color: theme.success }]}>已下载</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.downloadBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownload(share);
                    }}
                  >
                    <FontAwesome6 name="download" size={14} color={theme.buttonPrimaryText} />
                    <Text style={styles.downloadBtnText}>下载</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Loading More */}
        {loadingMore && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.detailModal}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <FontAwesome6 name="xmark" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <ThemedText variant="h4" color={theme.textPrimary}>句库详情</ThemedText>
            <View style={{ width: 20 }} />
          </View>
          
          {loadingDetail ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : fileDetail ? (
            <>
              <ScrollView style={styles.detailContent}>
                <ThemedText variant="h3" color={theme.textPrimary} style={styles.detailTitle}>
                  {fileDetail.title}
                </ThemedText>
                
                <View style={styles.detailMeta}>
                  <View style={styles.metaTag}>
                    <FontAwesome6 name="clock" size={12} color={theme.textMuted} />
                    <ThemedText variant="small" color={theme.textMuted}>
                      {formatDuration(fileDetail.original_duration)}
                    </ThemedText>
                  </View>
                  <View style={styles.metaTag}>
                    <FontAwesome6 name="list" size={12} color={theme.textMuted} />
                    <ThemedText variant="small" color={theme.textMuted}>
                      {fileDetail.items?.length || 0} 个句子
                    </ThemedText>
                  </View>
                </View>
                
                {fileDetail.description && (
                  <ThemedText variant="body" color={theme.textSecondary} style={styles.detailDescription}>
                    {fileDetail.description}
                  </ThemedText>
                )}
                
                {/* Sentences Preview */}
                <View style={styles.sentencesSection}>
                  <ThemedText variant="smallMedium" color={theme.textPrimary} style={styles.sectionTitle}>
                    句子列表
                  </ThemedText>
                  {fileDetail.items?.slice(0, 10).map((item, index) => (
                    <View key={item.id || index} style={styles.sentenceItem}>
                      <ThemedText variant="small" color={theme.textMuted} style={styles.sentenceIndex}>
                        {item.sentence_index + 1}.
                      </ThemedText>
                      <ThemedText variant="small" color={theme.textPrimary} style={styles.sentenceText}>
                        {item.text}
                      </ThemedText>
                    </View>
                  ))}
                  {fileDetail.items?.length > 10 && (
                    <ThemedText variant="tiny" color={theme.textMuted} style={{ marginTop: 8, textAlign: 'center' }}>
                      还有 {fileDetail.items.length - 10} 个句子...
                    </ThemedText>
                  )}
                </View>
              </ScrollView>
              
              <View style={styles.detailFooter}>
                {downloadedIds.has(selectedShare?.id || 0) ? (
                  <View style={styles.downloadedBadge}>
                    <FontAwesome6 name="check" size={16} color={theme.success} />
                    <Text style={styles.downloadedText}>已下载到我的句库</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.downloadBtn, { flex: 1, paddingVertical: Spacing.md }]}
                    onPress={() => selectedShare && handleDownload(selectedShare)}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                    ) : (
                      <>
                        <FontAwesome6 name="download" size={16} color={theme.buttonPrimaryText} />
                        <Text style={styles.downloadBtnText}>下载到我的句库</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ThemedText variant="body" color={theme.textMuted}>加载失败</ThemedText>
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}
