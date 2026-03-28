import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { getCachedAudio, precacheAudios } from '@/utils/lessonAudioCache';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

interface Sentence {
  id: number;
  sentence_index: number;
  english_text: string;
  chinese_text: string;
  audio_url?: string;
  audio_duration?: number;
}

interface Voice {
  id: string;
  name: string;
}

export default function LessonLearningScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ lessonId: string; title: string; voiceId?: string }>();
  const lessonId = params.lessonId;
  const title = params.title || '课时练习';
  const voiceId = params.voiceId || 'zh_female_xiaohe_uranus_bigtts';
  
  const { user } = useAuth();
  
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChinese, setShowChinese] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cachingProgress, setCachingProgress] = useState(0);
  
  const soundRef = useRef<Audio.Sound | null>(null);
  const inputRef = useRef<TextInput>(null);
  const currentSentence = sentences[currentIndex];
  
  // 获取课时数据
  const fetchData = useCallback(async () => {
    if (!lessonId) return;
    
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}?voiceId=${voiceId}`
      );
      const data = await response.json();
      
      if (data.sentences) {
        const sentencesWithAudio = data.sentences.filter((s: Sentence) => s.audio_url);
        setSentences(sentencesWithAudio);
        
        // 预缓存所有音频
        const audiosToCache = sentencesWithAudio.map((s: Sentence) => ({
          key: `lesson_${lessonId}_sentence_${s.sentence_index}_${voiceId}`,
          url: s.audio_url,
        }));
        
        // 后台缓存
        precacheAudios(audiosToCache).catch(e => console.log('[预缓存失败]', e));
      }
    } catch (error) {
      console.error('获取课时数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [lessonId, voiceId]);
  
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  
  // 播放当前句子音频
  const playAudio = useCallback(async () => {
    if (!currentSentence?.audio_url) return;
    
    try {
      // 释放之前的音频
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      // 获取缓存音频
      const cacheKey = `lesson_${lessonId}_sentence_${currentSentence.sentence_index}_${voiceId}`;
      const audioUri = await getCachedAudio(cacheKey, currentSentence.audio_url);
      
      console.log('[播放音频]', audioUri.substring(0, 50));
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (error) {
      console.error('播放失败:', error);
      setIsPlaying(false);
    }
  }, [currentSentence, lessonId, voiceId]);
  
  // 停止播放
  const stopAudio = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
    }
  }, []);
  
  // 切换句子时自动播放
  useEffect(() => {
    if (currentSentence) {
      setUserInput('');
      setShowChinese(false);
      setIsComplete(false);
      
      const timer = setTimeout(() => {
        playAudio();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [currentSentence?.id]);
  
  // 清理音频资源
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);
  
  // 检查输入是否正确
  const checkInput = useCallback(() => {
    if (!currentSentence) return;
    
    const normalizedInput = userInput.trim().toLowerCase();
    const normalizedTarget = currentSentence.english_text.trim().toLowerCase();
    
    // 简单比较（忽略标点）
    const cleanInput = normalizedInput.replace(/[.,!?;:'"]/g, '');
    const cleanTarget = normalizedTarget.replace(/[.,!?;:'"]/g, '');
    
    if (cleanInput === cleanTarget) {
      // 正确，显示中文，进入下一句
      setShowChinese(true);
      setIsComplete(true);
      
      setTimeout(() => {
        if (currentIndex < sentences.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          // 完成所有句子
          alert('恭喜！本课学习完成！');
        }
      }, 2000);
    } else {
      // 错误，显示提示
      setShowChinese(true);
      setTimeout(() => {
        setShowChinese(false);
      }, 1500);
    }
  }, [userInput, currentSentence, currentIndex, sentences.length]);
  
  // 下一句
  const handleNext = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, sentences.length]);
  
  // 上一句
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);
  
  // 返回
  const handleBack = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.unloadAsync();
    }
    router.back();
  }, [router]);
  
  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText variant="body" color={theme.textMuted} style={{ marginTop: 16 }}>
            加载中...
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
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ThemedText variant="body" color={theme.primary}>返回</ThemedText>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }
  
  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <FontAwesome6 name="chevron-left" size={16} color={theme.primary} />
              <ThemedText variant="body" color={theme.primary}>返回</ThemedText>
            </TouchableOpacity>
            <ThemedText variant="h3" color={theme.textPrimary}>{title}</ThemedText>
            <ThemedText variant="small" color={theme.textSecondary}>
              第 {currentIndex + 1} / {sentences.length} 句
            </ThemedText>
          </View>
          
          {/* 进度条 */}
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentIndex + 1) / sentences.length) * 100}%` }
              ]} 
            />
          </View>
          
          {/* 音频控制 */}
          <TouchableOpacity 
            style={styles.audioButton} 
            onPress={isPlaying ? stopAudio : playAudio}
          >
            <FontAwesome6 
              name={isPlaying ? "pause" : "play"} 
              size={24} 
              color={theme.primary} 
            />
            <ThemedText variant="body" color={theme.primary} style={{ marginLeft: 8 }}>
              {isPlaying ? '暂停' : '播放'}
            </ThemedText>
          </TouchableOpacity>
          
          {/* 输入区域 */}
          <View style={styles.inputSection}>
            <ThemedText variant="caption" color={theme.textMuted} style={{ marginBottom: 8 }}>
              请输入听到的内容：
            </ThemedText>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                isComplete && styles.inputCorrect,
                showChinese && !isComplete && styles.inputWrong,
              ]}
              value={userInput}
              onChangeText={setUserInput}
              placeholder="输入英文句子..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
          </View>
          
          {/* 中文翻译 */}
          {showChinese && currentSentence && (
            <View style={styles.chineseCard}>
              <ThemedText variant="body" color={theme.textPrimary}>
                {currentSentence.chinese_text}
              </ThemedText>
            </View>
          )}
          
          {/* 操作按钮 */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.secondaryBtn]} 
              onPress={handlePrev}
              disabled={currentIndex === 0}
            >
              <FontAwesome6 name="chevron-left" size={16} color={theme.textSecondary} />
              <ThemedText variant="small" color={theme.textSecondary}>上一句</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, styles.primaryBtn]} 
              onPress={checkInput}
            >
              <ThemedText variant="body" color={theme.buttonPrimaryText}>检查</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, styles.secondaryBtn]} 
              onPress={handleNext}
              disabled={currentIndex === sentences.length - 1}
            >
              <ThemedText variant="small" color={theme.textSecondary}>下一句</ThemedText>
              <FontAwesome6 name="chevron-right" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
