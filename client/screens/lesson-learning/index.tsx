import React, { useMemo } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { hasAudioLocal, generateCourseAudioKey } from '@/utils/audioStorage';

// 检测是否为 Web 端
const isWeb = (Platform as any).OS === 'web';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Sentence {
  id: number;
  sentence_index: number;
  english_text: string;
  chinese_text: string;
  audio_url?: string;
  audio_duration?: number;
}

export default function LessonLearningScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ 
    lessonId: string; 
    title: string; 
    voiceId?: string;
    courseId?: string;
    courseTitle?: string;
    lessonNumber?: string;
  }>();
  const lessonId = params.lessonId;
  const title = params.title || '课时练习';
  const voiceId = params.voiceId || 'zh_female_xiaohe_uranus_bigtts';
  const courseId = params.courseId;
  const courseTitle = params.courseTitle;
  const lessonNumber = params.lessonNumber;
  
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 获取课时数据，检查是否有可学习的句子
  const fetchData = useCallback(async () => {
    if (!lessonId) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${voiceId}`
      );
      const data = await response.json();
      
      if (data.sentences) {
        // Web 端：直接使用所有句子（使用在线 TTS）
        if (isWeb) {
          setSentences(data.sentences);
          if (data.sentences.length > 0) {
            setTimeout(() => {
              router.replace('/sentence-practice', {
                sourceType: 'lesson',
                lessonId: lessonId,
                voiceId: voiceId,
                title: title,
                courseId: courseId,
                courseTitle: courseTitle,
                lessonNumber: lessonNumber,
              });
            }, 100);
          }
          return;
        }
        
        // 移动端：检查每个句子是否有音频（后端 audio_url 或 本地缓存）
        const sentencesWithAudio: Sentence[] = [];
        
        for (const sentence of data.sentences) {
          // 后端有 audio_url
          if (sentence.audio_url) {
            sentencesWithAudio.push(sentence);
            continue;
          }
          
          // 检查本地缓存
          if (courseId) {
            const audioKey = generateCourseAudioKey(
              parseInt(courseId, 10),
              parseInt(lessonId, 10),
              sentence.sentence_index
            );
            const hasLocal = await hasAudioLocal(audioKey);
            if (hasLocal) {
              sentencesWithAudio.push(sentence);
            }
          }
        }
        
        setSentences(sentencesWithAudio);
        
        // 如果有可学习的句子，直接跳转到sentence-practice
        if (sentencesWithAudio.length > 0) {
          // 使用小延迟确保页面已挂载
          setTimeout(() => {
            router.replace('/sentence-practice', {
              sourceType: 'lesson',
              lessonId: lessonId,
              voiceId: voiceId,
              title: title,
              courseId: courseId,
              courseTitle: courseTitle,
              lessonNumber: lessonNumber,
            });
          }, 100);
        }
      }
    } catch (error) {
      console.error('获取课时数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [lessonId, voiceId, title, courseId, courseTitle, lessonNumber, router]);
  
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  
  // 返回
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);
  
  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            准备学习内容...
          </ThemedText>
        </View>
      </Screen>
    );
  }
  
  if (sentences.length === 0) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <FontAwesome6 name="volume-xmark" size={48} color={theme.textMuted} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            暂无可学习的句子
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: 8 }}>
            请先为此课时生成音频
          </ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ThemedText variant="body" color={theme.primary}>返回</ThemedText>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }
  
  // 如果有句子，显示加载状态（很快会跳转）
  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
          正在进入学习...
        </ThemedText>
      </View>
    </Screen>
  );
}
