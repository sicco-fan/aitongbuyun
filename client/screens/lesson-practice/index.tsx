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
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
// @ts-ignore - react-native-sse 类型定义不完整
import RNSSE from 'react-native-sse';
import { createStyles } from './styles';
import { 
  precacheVoiceAudios, 
  checkVoiceCacheStatus,
  DownloadProgress 
} from '@/utils/lessonAudioCache';
import { hasAudioLocal, generateCourseAudioKey, saveAudioToLocal } from '@/utils/audioStorage';

interface GenerateProgressData {
  type: 'start' | 'progress' | 'complete' | 'error' | 'audio';
  total?: number;
  sentences?: number;
  voices?: number;
  current?: number;
  percent?: number;
  sentence_index?: number;
  sentence_id?: number;
  voice_name?: string;
  voice_id?: string;
  status?: string;
  error?: string;
  generated?: number;
  already_exists?: number;
  failed?: number;
  message?: string;
  audio_base64?: string;
  audioBase64?: string;
  duration?: number;
}

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
  description?: string;
  recommended?: boolean;
}

interface VoiceCacheStatus {
  voiceId: string;
  voiceName: string;
  cached: number;
  total: number;
  hasAudio: boolean; // 该音色是否已生成音频
  isDownloading: boolean;
  description?: string;
  recommended?: boolean;
}

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

export default function LessonPracticeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ 
    lessonId: string; 
    title: string; 
    editSentenceId?: string; 
    returnTo?: string;
    courseId?: string;
    courseTitle?: string;
    lessonNumber?: string;
  }>();
  const lessonId = params.lessonId;
  const title = params.title || '课时练习';
  const editSentenceId = params.editSentenceId;
  const returnTo = params.returnTo;
  const courseId = params.courseId;
  const courseTitle = params.courseTitle;
  const lessonNumber = params.lessonNumber;
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('zh_female_vv_uranus_bigtts');
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
  // 进度条状态
  const [generatePercent, setGeneratePercent] = useState(0);
  const [generateCurrent, setGenerateCurrent] = useState(0);
  const [generateTotal, setGenerateTotal] = useState(0);
  const [generateCurrentTask, setGenerateCurrentTask] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sseRef = useRef<any>(null);
  
  // 编辑句子状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [editEnglishText, setEditEnglishText] = useState('');
  const [editChineseText, setEditChineseText] = useState('');
  const [saving, setSaving] = useState(false);
  
  // 功能说明弹窗
  const [showInfoModal, setShowInfoModal] = useState(false);

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
        
        // 如果有 editSentenceId 参数，自动打开编辑弹窗
        if (editSentenceId) {
          const sentenceToEdit = data.sentences.find(
            (s: Sentence) => s.id === parseInt(editSentenceId, 10)
          );
          if (sentenceToEdit) {
            // 延迟一点打开，确保页面已渲染
            setTimeout(() => {
              setEditingSentence(sentenceToEdit);
              setEditEnglishText(sentenceToEdit.english_text);
              setEditChineseText(sentenceToEdit.chinese_text);
              setShowEditModal(true);
            }, 300);
          }
        }
      }
      if (data.available_voices) {
        setVoices(data.available_voices);
        
        // 检查所有音色的状态
        const statuses: VoiceCacheStatus[] = [];
        for (const voice of data.available_voices) {
          // 检查该音色是否有音频（从 available_voices 判断）
          const sentencesWithVoice = data.sentences.filter(
            (s: Sentence) => s.available_voices && s.available_voices.includes(voice.id)
          );
          
          // 如果后端有该音色的音频，用那个数量；否则用所有句子数量来检查本地缓存
          const sentenceCountToCheck = sentencesWithVoice.length > 0 
            ? sentencesWithVoice.length 
            : data.sentences.length;
          
          // 检查缓存状态（需要先检查才能判断 hasAudio）
          const status = await checkVoiceCacheStatus(
            lessonId, 
            voice.id, 
            sentenceCountToCheck,
            courseId  // 传入 courseId 以检查 audioStorage 本地文件
          );
          
          // 有后端音频 或 有本地缓存 都算有音频
          const hasAudio = sentencesWithVoice.length > 0 || status.cached > 0;
          
          statuses.push({
            voiceId: voice.id,
            voiceName: voice.name,
            cached: status.cached,
            total: status.cached > 0 ? status.total : sentencesWithVoice.length, // 如果有缓存，用实际缓存数量
            hasAudio,
            isDownloading: false,
            description: voice.description,
            recommended: voice.recommended,
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
  }, [lessonId, selectedVoice, editSentenceId]);

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
    // 跳转到课程学习页面，传递完整的课程信息
    router.push('/lesson-learning', {
      lessonId: lessonId,
      voiceId: selectedVoice,
      title: title,
      courseId: courseId,
      courseTitle: courseTitle,
      lessonNumber: lessonNumber,
    });
  }, [router, lessonId, selectedVoice, title, courseId, courseTitle, lessonNumber]);

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
      const status = await checkVoiceCacheStatus(lessonId, voiceStatus.voiceId, sentencesWithAudio.length, courseId);
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
        const status = await checkVoiceCacheStatus(lessonId, voiceStatus.voiceId, sentencesWithAudio.length, courseId);
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
          Alert.alert('下载完成', `本地可用 ${status.cached}/${status.total} 个音频`);
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

  // 生成音频（使用SSE接收进度）
  const handleGenerateAudio = useCallback(() => {
    if (!lessonId || generating || selectedVoicesToGenerate.length === 0) return;
    
    setGenerating(true);
    setGeneratePercent(0);
    setGenerateCurrent(0);
    setGenerateTotal(0);
    setGenerateCurrentTask('正在初始化...');
    setGenerateProgress('');
    
    // 构建SSE URL
    const url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}/generate-audio`;
    
    // 创建SSE连接
    const sse = new RNSSE(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ voiceIds: selectedVoicesToGenerate }),
      lineEndingCharacter: '\n', // 显式指定换行符，避免自动检测失败
    });
    
    sseRef.current = sse;
    
    sse.addEventListener('message', (event) => {
      if (!event.data || event.data === '[DONE]') {
        sse.close();
        sseRef.current = null;
        return;
      }
      
      try {
        const data: GenerateProgressData = JSON.parse(event.data);
        
        switch (data.type) {
          case 'start':
            setGenerateTotal(data.total || 0);
            setGenerateCurrentTask(`开始生成 ${data.sentences} 个句子 × ${data.voices} 个音色`);
            break;
            
          case 'progress':
            if (data.current !== undefined && data.total !== undefined) {
              setGenerateCurrent(data.current);
              setGenerateTotal(data.total);
              setGeneratePercent(data.percent || 0);
            }
            const statusText = data.status === 'generated' ? '✓ 已生成' : 
                             data.status === 'already_exists' ? '○ 已存在' : '✗ 失败';
            setGenerateCurrentTask(`句子 ${data.sentence_index} · ${data.voice_name} - ${statusText}`);
            break;
            
          case 'audio':
            // 收到音频数据，保存到本地
            if ((data.audio_base64 || data.audioBase64) && data.sentence_index && data.voice_id) {
              const audioBase64 = data.audio_base64 || data.audioBase64;
              if (courseId && audioBase64) {
                // 生成音频存储 key（包含 voiceId 以区分不同音色）
                const audioKey = generateCourseAudioKey(
                  parseInt(courseId, 10),
                  parseInt(lessonId, 10),
                  data.sentence_index,
                  data.voice_id  // 传入 voiceId 以区分不同音色
                );
                
                // 保存到本地
                saveAudioToLocal(audioKey, audioBase64).then(() => {
                  console.log(`[音频生成] 已保存: ${audioKey}`);
                }).catch((e) => {
                  console.error(`[音频生成] 保存失败: ${audioKey}`, e);
                });
                
                // 更新进度显示
                const voiceName = data.voice_name || data.voice_id;
                setGenerateCurrentTask(`句子 ${data.sentence_index} · ${voiceName} - ✓ 已生成`);
                setGenerateCurrent(prev => prev + 1);
              }
            }
            break;
            
          case 'complete':
            setGeneratePercent(100);
            setGenerateProgress(
              `生成完成！\n` +
              `新生成: ${data.generated} 个\n` +
              `已存在: ${data.already_exists || 0} 个\n` +
              `失败: ${data.failed} 个`
            );
            setGenerateCurrentTask('完成！');
            
            // 2秒后关闭弹窗并刷新
            setTimeout(() => {
              sse.close();
              sseRef.current = null;
              setShowGenerateModal(false);
              setGenerating(false);
              setGenerateProgress('');
              setSelectedVoicesToGenerate([]);
              fetchData();
            }, 2000);
            break;
            
          case 'error':
            Alert.alert('生成失败', data.message || '未知错误');
            sse.close();
            sseRef.current = null;
            setGenerating(false);
            break;
        }
      } catch (e) {
        console.error('解析SSE数据失败:', e);
      }
    });
    
    sse.addEventListener('error', (event) => {
      console.error('SSE连接错误:', event);
      Alert.alert('连接失败', '无法连接到服务器，请稍后重试');
      sse.close();
      sseRef.current = null;
      setGenerating(false);
    });
  }, [generating, selectedVoicesToGenerate, lessonId, courseId, fetchData]);

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

  // 打开编辑弹窗
  const handleEditSentence = useCallback((sentence: Sentence) => {
    setEditingSentence(sentence);
    setEditEnglishText(sentence.english_text);
    setEditChineseText(sentence.chinese_text);
    setShowEditModal(true);
  }, []);

  // 保存编辑
  const handleSaveEdit = useCallback(async () => {
    if (!editingSentence) return;
    
    // 检查是否有修改
    if (editEnglishText === editingSentence.english_text && editChineseText === editingSentence.chinese_text) {
      setShowEditModal(false);
      // 如果是从学习页面跳转过来的，没有修改也返回
      if (returnTo === 'practice') {
        router.back();
      }
      return;
    }
    
    // 检查英文是否改变（需要重新生成音频）
    const englishChanged = editEnglishText !== editingSentence.english_text;
    const hasAudio = editingSentence.available_voices && editingSentence.available_voices.length > 0;
    
    // 如果英文改变且有音频，提示用户需要等待
    if (englishChanged && hasAudio) {
      Alert.alert(
        '保存提示',
        '修改英文文本后需要重新生成音频，这可能需要几秒钟。是否继续？',
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '继续保存', 
            onPress: () => doSave(englishChanged) 
          }
        ]
      );
    } else {
      doSave(englishChanged);
    }
  }, [editingSentence, editEnglishText, editChineseText, fetchData, returnTo]);
  
  // 执行保存
  const doSave = async (englishChanged: boolean) => {
    if (!editingSentence) return;
    
    setSaving(true);
    
    try {
      // 构建请求体
      // 如果英文改变了，不传chinese_text让后端自动翻译
      const requestBody: { english_text: string; chinese_text?: string } = {
        english_text: editEnglishText,
      };
      
      // 只有中文也被修改了才传递，否则让后端自动翻译
      const chineseChanged = editChineseText !== editingSentence.chinese_text;
      if (chineseChanged || !englishChanged) {
        requestBody.chinese_text = editChineseText;
      }
      
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/sentences/${editingSentence.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      
      const data = await response.json();
      
      if (data.sentence) {
        // 更新本地数据（使用后端返回的数据，可能包含自动翻译的中文）
        setSentences(prev => prev.map(s => 
          s.id === editingSentence.id 
            ? { ...s, english_text: data.sentence.english_text, chinese_text: data.sentence.chinese_text }
            : s
        ));
        setShowEditModal(false);
        
        // 如果是从学习页面跳转过来的，保存后返回
        if (returnTo === 'practice') {
          Alert.alert('✓ 保存成功', '句子已更新', [
            { text: '知道了', onPress: () => router.back() }
          ]);
          return;
        }
        
        // 构建提示信息
        let message = '';
        if (data.auto_translated) {
          message = `英文已更新，中文已自动翻译：\n\n${data.sentence.chinese_text}\n\n`;
        }
        
        // 显示结果提示
        if (data.regenerated_voices && data.regenerated_voices.length > 0) {
          message += `已自动重新生成以下音色的音频：\n${data.regenerated_voices.join('、')}\n\n请重新下载音频缓存以使用新音频。`;
          Alert.alert(
            '✓ 保存成功',
            message,
            [{ text: '知道了', onPress: () => fetchData() }]
          );
        } else if (englishChanged) {
          message += '该句子暂无音频，请先生成音频。';
          Alert.alert('✓ 保存成功', message);
        } else {
          Alert.alert('✓ 保存成功', '中文翻译已更新。');
        }
      } else {
        throw new Error(data.error || '保存失败');
      }
    } catch (error: any) {
      Alert.alert('保存失败', error.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除句子
  const handleDeleteSentence = useCallback((sentence: Sentence) => {
    Alert.alert(
      '确认删除',
      `确定要删除第 ${sentence.sentence_index} 句吗？\n\n"${sentence.english_text.substring(0, 30)}${sentence.english_text.length > 30 ? '...' : ''}"\n\n此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: () => doDeleteSentence(sentence)
        }
      ]
    );
  }, []);

  // 执行删除
  const doDeleteSentence = async (sentence: Sentence) => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/sentences/${sentence.id}`,
        {
          method: 'DELETE',
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        // 从本地列表中移除
        setSentences(prev => {
          const filtered = prev.filter(s => s.id !== sentence.id);
          // 更新序号
          return filtered.map(s => 
            s.sentence_index > sentence.sentence_index 
              ? { ...s, sentence_index: s.sentence_index - 1 }
              : s
          );
        });
        
        // 更新课时的句子计数
        if (lesson) {
          setLesson({ ...lesson, sentences_count: data.remaining_count });
        }
        
        Alert.alert('✓ 删除成功', `句子已删除，当前剩余 ${data.remaining_count} 个句子`);
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (error: any) {
      Alert.alert('删除失败', error.message || '请稍后重试');
    }
  };

  // 检查是否有音频（后端数据库 或 本地缓存）
  // Web 端：始终使用在线 TTS，不需要缓存
  const hasAudioFromDb = sentences.some(s => s.audio_url);
  const hasLocalCache = voiceCacheStatuses.some(s => s.cached > 0);
  const hasAudio = Platform.OS === 'web' ? sentences.length > 0 : (hasAudioFromDb || hasLocalCache);
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
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <FontAwesome6 name="chevron-left" size={16} color={theme.primary} />
            <ThemedText variant="body" color={theme.primary} style={styles.backButtonText}>
              返回课时列表
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleArea}>
              <ThemedText variant="h2" color={theme.textPrimary} style={styles.title}>
                {title}
              </ThemedText>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => setShowInfoModal(true)}
              >
                <FontAwesome6 name="circle-info" size={14} color={theme.border} />
              </TouchableOpacity>
            </View>
            {/* 快速学习入口 */}
            {hasAudio && (
              <TouchableOpacity
                style={styles.quickStartButton}
                onPress={handleStartPractice}
              >
                <FontAwesome6 name="headphones" size={14} color={theme.buttonPrimaryText} />
                <ThemedText variant="smallMedium" color={theme.buttonPrimaryText} style={{ marginLeft: 4 }}>
                  开始学习
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
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
                    voiceStatus.recommended && styles.voiceCardRecommended,
                  ]}
                  onPress={() => setSelectedVoice(voiceStatus.voiceId)}
                  disabled={isDownloading}
                >
                  <View style={styles.voiceCardHeader}>
                    <View style={styles.voiceInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <ThemedText
                          variant="body"
                          color={isSelected ? theme.primary : theme.textPrimary}
                          style={styles.voiceName}
                        >
                          {voiceStatus.voiceName}
                        </ThemedText>
                        {voiceStatus.recommended && (
                          <View style={styles.recommendedBadge}>
                            <FontAwesome6 name="star" size={10} color={theme.buttonPrimaryText} />
                            <ThemedText variant="caption" color={theme.buttonPrimaryText} style={{ marginLeft: 2 }}>
                              推荐
                            </ThemedText>
                          </View>
                        )}
                        {!voiceStatus.hasAudio && (
                          <View style={styles.notGeneratedBadge}>
                            <ThemedText variant="caption" color={theme.textMuted}>
                              未生成
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      {voiceStatus.description && (
                        <ThemedText variant="caption" color={theme.textMuted} style={{ marginTop: 2 }}>
                          {voiceStatus.description}
                        </ThemedText>
                      )}
                      <View style={styles.voiceStatusRow}>
                        {!voiceStatus.hasAudio ? (
                          <ThemedText variant="caption" color={theme.textMuted}>
                            点击右侧生成
                          </ThemedText>
                        ) : isFullyCached ? (
                          <View style={styles.cachedBadge}>
                            <FontAwesome6 name="check-circle" size={12} color={theme.success} />
                            <ThemedText variant="caption" color={theme.success} style={{ marginLeft: 4 }}>
                              本地可用
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

        {/* 句子列表 */}
        {sentences.map((sentence) => (
          <View key={sentence.id} style={styles.sentenceCard}>
            <View style={styles.sentenceCardHeader}>
              <ThemedText variant="caption" color={theme.textMuted} style={styles.sentenceIndex}>
                句子 {sentence.sentence_index}
              </ThemedText>
              <View style={styles.sentenceActions}>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEditSentence(sentence)}
                >
                  <FontAwesome6 name="pen" size={12} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleDeleteSentence(sentence)}
                >
                  <FontAwesome6 name="trash" size={12} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
            <ThemedText variant="body" color={theme.textPrimary} style={styles.englishText}>
              {sentence.english_text}
            </ThemedText>
            <ThemedText variant="small" color={theme.textSecondary} style={styles.chineseText}>
              {sentence.chinese_text}
            </ThemedText>
          </View>
        ))}

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
            
            {generating ? (
              <View style={styles.generateProgress}>
                {/* 进度条 */}
                <View style={styles.generateProgressBar}>
                  <View 
                    style={[
                      styles.generateProgressFill,
                      { width: `${generatePercent}%` }
                    ]} 
                  />
                </View>
                
                {/* 进度数字 */}
                <View style={styles.generateProgressInfo}>
                  <ThemedText variant="h3" color={theme.primary}>
                    {generatePercent}%
                  </ThemedText>
                  <ThemedText variant="body" color={theme.textSecondary}>
                    {generateCurrent} / {generateTotal}
                  </ThemedText>
                </View>
                
                {/* 当前任务 */}
                <ThemedText variant="small" color={theme.textMuted} style={{ textAlign: 'center', marginTop: 8 }}>
                  {generateCurrentTask}
                </ThemedText>
                
                {/* 完成信息 */}
                {generateProgress ? (
                  <ThemedText variant="body" color={theme.success} style={{ marginTop: 16, textAlign: 'center' }}>
                    {generateProgress}
                  </ThemedText>
                ) : (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 16 }} />
                )}
              </View>
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowGenerateModal(false);
                    setSelectedVoicesToGenerate([]);
                  }}
                >
                  <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, selectedVoicesToGenerate.length === 0 && { opacity: 0.5 }]}
                  onPress={handleGenerateAudio}
                  disabled={selectedVoicesToGenerate.length === 0}
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
      
      {/* 编辑句子弹窗 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setShowEditModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <ThemedText variant="h4" color={theme.textPrimary}>
                    编辑句子 {editingSentence?.sentence_index}
                  </ThemedText>
                  <TouchableOpacity 
                    onPress={() => setShowEditModal(false)}
                    disabled={saving}
                  >
                    <FontAwesome6 name="times" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.editField}>
                  <ThemedText variant="small" color={theme.textSecondary} style={styles.editLabel}>
                    英文
                  </ThemedText>
                  <TextInput
                    style={[styles.editInput, { 
                      backgroundColor: theme.backgroundTertiary,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                    }]}
                    value={editEnglishText}
                    onChangeText={setEditEnglishText}
                    multiline
                    numberOfLines={3}
                    placeholder="输入英文句子"
                    placeholderTextColor={theme.textMuted}
                    editable={!saving}
                  />
                </View>
                
                <View style={styles.editField}>
                  <ThemedText variant="small" color={theme.textSecondary} style={styles.editLabel}>
                    中文
                  </ThemedText>
                  <TextInput
                    style={[styles.editInput, { 
                      backgroundColor: theme.backgroundTertiary,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                    }]}
                    value={editChineseText}
                    onChangeText={setEditChineseText}
                    multiline
                    numberOfLines={2}
                    placeholder="输入中文翻译"
                    placeholderTextColor={theme.textMuted}
                    editable={!saving}
                  />
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowEditModal(false)}
                    disabled={saving}
                  >
                    <ThemedText variant="body" color={theme.textSecondary}>取消</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, saving && { opacity: 0.5 }]}
                    onPress={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={theme.buttonPrimaryText} />
                    ) : (
                      <ThemedText variant="body" color={theme.buttonPrimaryText}>保存</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 功能说明弹窗 */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContent}>
            <View style={styles.infoModalHeader}>
              <ThemedText variant="h4" color={theme.textPrimary}>
                关于课时学习
              </ThemedText>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <FontAwesome6 name="times" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoModalBody}>
              {/* 如何学习 */}
              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  🎧 如何开始学习？
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  1. 选择一个音色（推荐"薇薇"）{"\n"}
                  2. 点击"生成音频"按钮生成语音{"\n"}
                  3. 点击右侧下载图标缓存到本地{"\n"}
                  4. 点击"开始学习"进入听写练习
                </ThemedText>
              </View>

              {/* 关于音色 */}
              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  🗣️ 关于音色
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  不同音色有不同的朗读风格。生成音频后，可以下载到本地，这样学习时不需要网络也能播放。
                </ThemedText>
              </View>

              {/* 关于缓存 */}
              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  💾 "未缓存"是什么意思？
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  "未缓存"表示音频已生成但未下载到本地。点击音色右侧的下载按钮即可缓存，离线也能学习。
                </ThemedText>
              </View>

              {/* 编辑句子 */}
              <View style={styles.infoSection}>
                <ThemedText variant="bodyMedium" color={theme.textPrimary} style={styles.infoSectionTitle}>
                  ✏️ 编辑句子
                </ThemedText>
                <ThemedText variant="body" color={theme.textSecondary} style={styles.infoSectionText}>
                  点击句子右侧的编辑图标可以修改英文和中文。修改英文后会自动重新生成音频。
                </ThemedText>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.infoModalCloseBtn}
              onPress={() => setShowInfoModal(false)}
            >
              <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>知道了</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
