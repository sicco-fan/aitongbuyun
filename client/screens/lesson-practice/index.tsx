import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { 
  precacheVoiceAudios, 
  checkVoiceCacheStatus,
  DownloadProgress 
} from '@/utils/lessonAudioCache';

interface Sentence {
  id: number;
  sentence_index: number;
  english_text: string;
  chinese_text: string;
  audio_url?: string;
  audio_duration?: number;
}

interface Lesson {
  id: number;
  lesson_number: number;
  title: string;
  description: string;
  sentences_count: number;
}

interface Voice {
  id: string;
  name: string;
  gender: string;
  style: string;
}

interface VoiceCacheStatus {
  voiceId: string;
  voiceName: string;
  cached: number;
  total: number;
  isDownloading: boolean;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function LessonPracticeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ lessonId: string; title: string }>();
  const lessonId = params.lessonId;
  const title = params.title || '课时练习';
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('zh_female_xiaohe_uranus_bigtts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 音色缓存状态
  const [voiceCacheStatuses, setVoiceCacheStatuses] = useState<VoiceCacheStatus[]>([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadingVoiceId, setDownloadingVoiceId] = useState<string | null>(null);
  const downloadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!lessonId) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${selectedVoice}`
      );
      const data = await response.json();
      
      if (data.lesson) {
        setLesson(data.lesson);
      }
      if (data.sentences) {
        setSentences(data.sentences);
      }
      if (data.available_voices) {
        setVoices(data.available_voices);
        
        // 检查所有音色的缓存状态
        const statuses: VoiceCacheStatus[] = [];
        for (const voice of data.available_voices) {
          const status = await checkVoiceCacheStatus(
            lessonId, 
            voice.id, 
            data.sentences.filter((s: Sentence) => s.audio_url).length
          );
          statuses.push({
            voiceId: voice.id,
            voiceName: voice.name,
            cached: status.cached,
            total: status.total,
            isDownloading: false,
          });
        }
        setVoiceCacheStatuses(statuses);
      }
    } catch (error) {
      console.error('获取课时内容失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lessonId, selectedVoice]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleStartPractice = useCallback(() => {
    // 跳转到课程学习页面
    router.push('/lesson-learning', {
      lessonId: lessonId,
      voiceId: selectedVoice,
      title: title,
    });
  }, [router, lessonId, selectedVoice, title]);

  // 下载单个音色
  const handleDownloadVoice = useCallback(async (voiceId: string) => {
    if (downloadingRef.current) return;
    
    const sentencesWithAudio = sentences.filter(s => s.audio_url);
    if (sentencesWithAudio.length === 0) return;
    
    // 获取该音色的音频URL（需要先请求后端获取）
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${voiceId}`
      );
      const data = await response.json();
      
      if (!data.sentences || data.sentences.length === 0) {
        Alert.alert('提示', '该音色暂无音频，请先生成');
        return;
      }
      
      downloadingRef.current = true;
      setDownloadingVoiceId(voiceId);
      
      // 更新状态为下载中
      setVoiceCacheStatuses(prev => 
        prev.map(s => 
          s.voiceId === voiceId ? { ...s, isDownloading: true } : s
        )
      );
      
      await precacheVoiceAudios(
        lessonId,
        voiceId,
        data.sentences,
        (progress) => {
          setDownloadProgress(progress);
        }
      );
      
      // 更新缓存状态
      const status = await checkVoiceCacheStatus(lessonId, voiceId, sentencesWithAudio.length);
      setVoiceCacheStatuses(prev => 
        prev.map(s => 
          s.voiceId === voiceId ? { 
            ...s, 
            cached: status.cached, 
            total: status.total,
            isDownloading: false 
          } : s
        )
      );
      
    } catch (error) {
      console.error('下载音色失败:', error);
      Alert.alert('下载失败', '请检查网络连接');
      setVoiceCacheStatuses(prev => 
        prev.map(s => 
          s.voiceId === voiceId ? { ...s, isDownloading: false } : s
        )
      );
    } finally {
      downloadingRef.current = false;
      setDownloadingVoiceId(null);
      setDownloadProgress(null);
    }
  }, [lessonId, sentences]);

  // 下载全部音色
  const handleDownloadAllVoices = useCallback(async () => {
    if (downloadingRef.current || voices.length === 0) return;
    
    downloadingRef.current = true;
    setShowDownloadModal(true);
    
    const sentencesWithAudio = sentences.filter(s => s.audio_url);
    
    for (const voice of voices) {
      try {
        // 获取该音色的音频URL
        const response = await fetch(
          `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${voice.id}`
        );
        const data = await response.json();
        
        if (!data.sentences || data.sentences.length === 0) {
          continue;
        }
        
        setDownloadingVoiceId(voice.id);
        setVoiceCacheStatuses(prev => 
          prev.map(s => 
            s.voiceId === voice.id ? { ...s, isDownloading: true } : s
          )
        );
        
        await precacheVoiceAudios(
          lessonId,
          voice.id,
          data.sentences,
          (progress) => {
            setDownloadProgress({
              ...progress,
              currentVoice: voice.name,
            });
          }
        );
        
        // 更新缓存状态
        const status = await checkVoiceCacheStatus(lessonId, voice.id, sentencesWithAudio.length);
        setVoiceCacheStatuses(prev => 
          prev.map(s => 
            s.voiceId === voice.id ? { 
              ...s, 
              cached: status.cached, 
              total: status.total,
              isDownloading: false 
            } : s
          )
        );
        
      } catch (error) {
        console.error(`下载音色 ${voice.name} 失败:`, error);
      }
    }
    
    downloadingRef.current = false;
    setDownloadingVoiceId(null);
    setDownloadProgress(null);
    setShowDownloadModal(false);
  }, [lessonId, voices, sentences]);

  const hasAudio = sentences.some(s => s.audio_url);
  const allDownloaded = voiceCacheStatuses.length > 0 && 
    voiceCacheStatuses.every(s => s.cached === s.total && s.total > 0);
  const someDownloaded = voiceCacheStatuses.some(s => s.cached > 0);

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载课时内容中...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FontAwesome6 name="chevron-left" size={16} color={theme.primary} />
          <ThemedText variant="body" color={theme.primary} style={styles.backButtonText}>
            返回课时列表
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.header}>
          <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText variant="small" color={theme.textSecondary} style={styles.subtitle}>
            {lesson?.description || '共 ' + sentences.length + ' 个句子'}
          </ThemedText>
        </View>

        {/* 音色选择 */}
        <View style={styles.voiceSection}>
          <View style={styles.sectionHeader}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.sectionTitle}>
              选择音色
            </ThemedText>
            {hasAudio && !allDownloaded && (
              <TouchableOpacity 
                style={styles.downloadAllButton}
                onPress={handleDownloadAllVoices}
              >
                <FontAwesome6 name="download" size={14} color={theme.primary} />
                <ThemedText variant="small" color={theme.primary} style={{ marginLeft: 4 }}>
                  预下载全部
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.voiceList}>
            {voiceCacheStatuses.map((voiceStatus) => {
              const isSelected = selectedVoice === voiceStatus.voiceId;
              const isFullyCached = voiceStatus.cached === voiceStatus.total && voiceStatus.total > 0;
              const isPartiallyCached = voiceStatus.cached > 0 && voiceStatus.cached < voiceStatus.total;
              const isDownloading = voiceStatus.isDownloading;
              
              return (
                <TouchableOpacity
                  key={voiceStatus.voiceId}
                  style={[
                    styles.voiceCard,
                    isSelected && styles.voiceCardSelected,
                  ]}
                  onPress={() => setSelectedVoice(voiceStatus.voiceId)}
                  disabled={isDownloading}
                >
                  <View style={styles.voiceCardHeader}>
                    <View style={styles.voiceInfo}>
                      <ThemedText
                        variant="body"
                        color={isSelected ? theme.primary : theme.textPrimary}
                        style={styles.voiceName}
                      >
                        {voiceStatus.voiceName}
                      </ThemedText>
                      <View style={styles.voiceStatusRow}>
                        {isFullyCached ? (
                          <View style={styles.cachedBadge}>
                            <FontAwesome6 name="check-circle" size={12} color={theme.success} />
                            <ThemedText variant="caption" color={theme.success} style={{ marginLeft: 4 }}>
                              已缓存
                            </ThemedText>
                          </View>
                        ) : isPartiallyCached ? (
                          <ThemedText variant="caption" color={theme.textMuted}>
                            {voiceStatus.cached}/{voiceStatus.total}
                          </ThemedText>
                        ) : voiceStatus.total === 0 ? (
                          <ThemedText variant="caption" color={theme.textMuted}>
                            未生成
                          </ThemedText>
                        ) : null}
                        
                        {isDownloading && (
                          <View style={styles.downloadingIndicator}>
                            <ActivityIndicator size="small" color={theme.primary} />
                            <ThemedText variant="caption" color={theme.primary} style={{ marginLeft: 4 }}>
                              下载中...
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {!isFullyCached && voiceStatus.total > 0 && !isDownloading && (
                      <TouchableOpacity
                        style={styles.downloadButton}
                        onPress={() => handleDownloadVoice(voiceStatus.voiceId)}
                      >
                        <FontAwesome6 name="cloud-download" size={16} color={theme.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* 缓存进度条 */}
                  {voiceStatus.total > 0 && (
                    <View style={styles.cacheProgressBar}>
                      <View 
                        style={[
                          styles.cacheProgressFill,
                          { 
                            width: `${(voiceStatus.cached / voiceStatus.total) * 100}%`,
                            backgroundColor: isFullyCached ? theme.success : theme.primary,
                          }
                        ]} 
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 统计信息 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText variant="h3" color={theme.primary} style={styles.statValue}>
              {sentences.length}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              句子数
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText variant="h3" color={theme.primary} style={styles.statValue}>
              {sentences.filter(s => s.audio_url).length}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              已生成音频
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText variant="h3" color={hasAudio ? theme.success : theme.textMuted} style={styles.statValue}>
              {hasAudio ? '✓' : '○'}
            </ThemedText>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.statLabel}>
              可学习
            </ThemedText>
          </View>
        </View>

        {/* 句子预览 */}
        {sentences.slice(0, 5).map((sentence) => (
          <View key={sentence.id} style={styles.sentenceCard}>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.sentenceIndex}>
              句子 {sentence.sentence_index}
            </ThemedText>
            <ThemedText variant="body" color={theme.textPrimary} style={styles.englishText}>
              {sentence.english_text}
            </ThemedText>
            <ThemedText variant="small" color={theme.textSecondary} style={styles.chineseText}>
              {sentence.chinese_text}
            </ThemedText>
          </View>
        ))}

        {sentences.length > 5 && (
          <ThemedText variant="small" color={theme.textMuted} style={{ textAlign: 'center', marginBottom: 16 }}>
            还有 {sentences.length - 5} 个句子...
          </ThemedText>
        )}

        {/* 开始练习按钮 */}
        <TouchableOpacity
          style={[styles.startButton, !hasAudio && { backgroundColor: theme.textMuted }]}
          onPress={handleStartPractice}
          disabled={!hasAudio}
        >
          <FontAwesome6 name="headphones" size={18} color={theme.buttonPrimaryText} style={{ marginRight: 8 }} />
          <ThemedText variant="body" color={theme.buttonPrimaryText} style={styles.startButtonText}>
            {hasAudio ? '开始听写练习' : '请先生成音频'}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
      
      {/* 下载进度弹窗 */}
      <Modal
        visible={showDownloadModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              正在预下载音色音频
            </ThemedText>
            
            {downloadProgress && (
              <>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.modalSubtitle}>
                  {downloadProgress.currentVoice}
                </ThemedText>
                
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${downloadProgress.voiceProgress}%` }
                    ]} 
                  />
                </View>
                
                <ThemedText variant="body" color={theme.textPrimary} style={styles.progressText}>
                  {downloadProgress.current} / {downloadProgress.total} 个句子
                </ThemedText>
                
                <ThemedText variant="caption" color={theme.textMuted} style={styles.progressPercent}>
                  {downloadProgress.voiceProgress}%
                </ThemedText>
              </>
            )}
            
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
