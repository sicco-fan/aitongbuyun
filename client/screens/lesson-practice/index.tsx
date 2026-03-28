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
  Platform,
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
  available_voices?: string[];
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
  hasAudio: boolean; // 该音色是否已生成音频
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
  
  // 生成音频状态
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedVoicesToGenerate, setSelectedVoicesToGenerate] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string>('');

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
        
        // 检查所有音色的状态
        const statuses: VoiceCacheStatus[] = [];
        for (const voice of data.available_voices) {
          // 检查该音色是否有音频（从第一个句子判断）
          const sentencesWithVoice = data.sentences.filter(
            (s: Sentence) => s.available_voices && s.available_voices.includes(voice.id)
          );
          const hasAudio = sentencesWithVoice.length > 0;
          
          // 检查缓存状态
          const status = await checkVoiceCacheStatus(
            lessonId, 
            voice.id, 
            sentencesWithVoice.length
          );
          
          statuses.push({
            voiceId: voice.id,
            voiceName: voice.name,
            cached: status.cached,
            total: status.total,
            hasAudio,
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
  const handleDownloadVoice = useCallback(async (voiceStatus: VoiceCacheStatus) => {
    // 如果音频未生成，先提示生成
    if (!voiceStatus.hasAudio) {
      Alert.alert(
        '音频未生成',
        '该音色的音频尚未生成，是否立即生成？',
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '生成音频', 
            onPress: () => {
              setSelectedVoicesToGenerate([voiceStatus.voiceId]);
              setShowGenerateModal(true);
            }
          }
        ]
      );
      return;
    }
    
    if (downloadingRef.current) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${voiceStatus.voiceId}`
      );
      const data = await response.json();
      
      if (!data.sentences || data.sentences.filter((s: Sentence) => s.audio_url).length === 0) {
        Alert.alert('提示', '该音色暂无音频');
        return;
      }
      
      downloadingRef.current = true;
      setDownloadingVoiceId(voiceStatus.voiceId);
      
      setVoiceCacheStatuses(prev => 
        prev.map(s => 
          s.voiceId === voiceStatus.voiceId ? { ...s, isDownloading: true } : s
        )
      );
      
      await precacheVoiceAudios(
        lessonId,
        voiceStatus.voiceId,
        data.sentences,
        (progress) => {
          setDownloadProgress(progress);
        }
      );
      
      const sentencesWithAudio = data.sentences.filter((s: Sentence) => s.audio_url);
      const status = await checkVoiceCacheStatus(lessonId, voiceStatus.voiceId, sentencesWithAudio.length);
      setVoiceCacheStatuses(prev => 
        prev.map(s => 
          s.voiceId === voiceStatus.voiceId ? { 
            ...s, 
            cached: status.cached, 
            total: status.total,
            isDownloading: false 
          } : s
        )
      );
      
    } catch (error) {
      console.error('下载音色失败:', error);
      
      try {
        const response = await fetch(
          `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${voiceStatus.voiceId}`
        );
        const data = await response.json();
        const sentencesWithAudio = data.sentences.filter((s: Sentence) => s.audio_url);
        const status = await checkVoiceCacheStatus(lessonId, voiceStatus.voiceId, sentencesWithAudio.length);
        setVoiceCacheStatuses(prev => 
          prev.map(s => 
            s.voiceId === voiceStatus.voiceId ? { 
              ...s, 
              cached: status.cached, 
              total: status.total,
              isDownloading: false 
            } : s
          )
        );
        
        if (status.cached > 0) {
          Alert.alert('下载完成', `已缓存 ${status.cached}/${status.total} 个音频`);
        } else {
          Alert.alert('下载失败', '请检查网络连接后重试');
        }
      } catch {
        Alert.alert('下载失败', '请检查网络连接后重试');
        setVoiceCacheStatuses(prev => 
          prev.map(s => 
            s.voiceId === voiceStatus.voiceId ? { ...s, isDownloading: false } : s
          )
        );
      }
    } finally {
      downloadingRef.current = false;
      setDownloadingVoiceId(null);
      setDownloadProgress(null);
    }
  }, [lessonId]);

  // 生成音频
  const handleGenerateAudio = useCallback(async () => {
    if (generating || selectedVoicesToGenerate.length === 0) return;
    
    setGenerating(true);
    setGenerateProgress('正在生成音频...');
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}/generate-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceIds: selectedVoicesToGenerate }),
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setGenerateProgress(
          `生成完成！\n` +
          `新生成: ${data.generated} 个\n` +
          `已存在: ${data.already_exists} 个\n` +
          `失败: ${data.failed} 个`
        );
        
        // 刷新数据
        setTimeout(() => {
          setShowGenerateModal(false);
          setGenerating(false);
          setGenerateProgress('');
          setSelectedVoicesToGenerate([]);
          fetchData();
        }, 2000);
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (error: any) {
      Alert.alert('生成失败', error.message || '请稍后重试');
      setGenerating(false);
      setGenerateProgress('');
    }
  }, [generating, selectedVoicesToGenerate, lessonId, fetchData]);

  // 切换音色选择
  const toggleVoiceSelection = useCallback((voiceId: string) => {
    setSelectedVoicesToGenerate(prev => 
      prev.includes(voiceId) 
        ? prev.filter(id => id !== voiceId)
        : [...prev, voiceId]
    );
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedVoicesToGenerate.length === voices.length) {
      setSelectedVoicesToGenerate([]);
    } else {
      setSelectedVoicesToGenerate(voices.map(v => v.id));
    }
  }, [selectedVoicesToGenerate, voices]);

  const hasAudio = sentences.some(s => s.audio_url);
  const selectedVoiceStatus = voiceCacheStatuses.find(s => s.voiceId === selectedVoice);
  const allDownloaded = voiceCacheStatuses.length > 0 && 
    voiceCacheStatuses.filter(s => s.hasAudio).every(s => s.cached === s.total && s.total > 0);

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
            <TouchableOpacity 
              style={styles.generateAllButton}
              onPress={() => {
                setSelectedVoicesToGenerate(voices.map(v => v.id));
                setShowGenerateModal(true);
              }}
            >
              <FontAwesome6 name="wand-magic-sparkles" size={14} color={theme.buttonPrimaryText} />
              <ThemedText variant="small" color={theme.buttonPrimaryText} style={{ marginLeft: 4 }}>
                生成音频
              </ThemedText>
            </TouchableOpacity>
          </View>
          
          <View style={styles.voiceList}>
            {voiceCacheStatuses.map((voiceStatus) => {
              const isSelected = selectedVoice === voiceStatus.voiceId;
              const isFullyCached = voiceStatus.hasAudio && voiceStatus.cached === voiceStatus.total && voiceStatus.total > 0;
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
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ThemedText
                          variant="body"
                          color={isSelected ? theme.primary : theme.textPrimary}
                          style={styles.voiceName}
                        >
                          {voiceStatus.voiceName}
                        </ThemedText>
                        {!voiceStatus.hasAudio && (
                          <View style={styles.notGeneratedBadge}>
                            <ThemedText variant="caption" color={theme.textMuted}>
                              未生成
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <View style={styles.voiceStatusRow}>
                        {!voiceStatus.hasAudio ? (
                          <ThemedText variant="caption" color={theme.textMuted}>
                            点击右侧生成
                          </ThemedText>
                        ) : isFullyCached ? (
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
                        ) : voiceStatus.total > 0 ? (
                          <ThemedText variant="caption" color={theme.textMuted}>
                            未缓存
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
                    
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleDownloadVoice(voiceStatus)}
                    >
                      <FontAwesome6 
                        name={voiceStatus.hasAudio ? "cloud-download" : "wand-magic-sparkles"} 
                        size={16} 
                        color={theme.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {/* 缓存进度条 */}
                  {voiceStatus.hasAudio && voiceStatus.total > 0 && (
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
              当前音色音频
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
              {Platform.OS === 'web' ? '正在预加载音频' : '正在下载音频'}
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
            
            {Platform.OS === 'web' && (
              <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 12, textAlign: 'center' }}>
                音频将缓存到浏览器，下次播放更快
              </ThemedText>
            )}
          </View>
        </View>
      </Modal>
      
      {/* 生成音频弹窗 */}
      <Modal
        visible={showGenerateModal}
        transparent
        animationType="slide"
        onRequestClose={() => !generating && setShowGenerateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <ThemedText variant="h4" color={theme.textPrimary} style={styles.modalTitle}>
              选择要生成的音色
            </ThemedText>
            
            <View style={styles.voiceSelectList}>
              {voices.map((voice) => {
                const isSelected = selectedVoicesToGenerate.includes(voice.id);
                return (
                  <TouchableOpacity
                    key={voice.id}
                    style={[
                      styles.voiceSelectItem,
                      isSelected && styles.voiceSelectItemSelected,
                    ]}
                    onPress={() => toggleVoiceSelection(voice.id)}
                    disabled={generating}
                  >
                    <View style={styles.voiceSelectCheckbox}>
                      {isSelected && (
                        <FontAwesome6 name="check" size={12} color={theme.buttonPrimaryText} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="body" color={isSelected ? theme.primary : theme.textPrimary}>
                        {voice.name}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.textMuted}>
                        {voice.gender === 'female' ? '女声' : '男声'} · {voice.style}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity 
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
              disabled={generating}
            >
              <ThemedText variant="small" color={theme.primary}>
                {selectedVoicesToGenerate.length === voices.length ? '取消全选' : '全选'}
              </ThemedText>
            </TouchableOpacity>
            
            {generateProgress ? (
              <View style={styles.generateProgress}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText variant="body" color={theme.textPrimary} style={{ marginTop: 12, textAlign: 'center' }}>
                  {generateProgress}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowGenerateModal(false);
                    setSelectedVoicesToGenerate([]);
                  }}
                  disabled={generating}
                >
                  <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, selectedVoicesToGenerate.length === 0 && { opacity: 0.5 }]}
                  onPress={handleGenerateAudio}
                  disabled={generating || selectedVoicesToGenerate.length === 0}
                >
                  <ThemedText variant="body" color={theme.buttonPrimaryText}>
                    生成 ({selectedVoicesToGenerate.length})
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
