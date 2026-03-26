import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { Screen } from '@/components/Screen';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TimeControl } from '@/components/TimeControl';
import { Audio } from 'expo-av';

// 后端服务地址
const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

// 语速范围限制（词/分钟）
const MIN_WPM = 50;
const MAX_WPM = 250;
const DEFAULT_WPM = 150;

/**
 * 统计文本中的单词数量
 * @param text 文本
 * @returns 单词数量
 */
const countWords = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
};

/**
 * 根据单词数和每分钟单词数计算预估时长（秒）
 * @param wordCount 单词数量
 * @param wordsPerMinute 每分钟单词数
 * @returns 预估时长（秒）
 */
const calculateEstimatedDuration = (wordCount: number, wordsPerMinute: number): number => {
  // 计算时长：单词数 / (WPM) = 分钟数，转换为秒
  const durationMinutes = wordCount / wordsPerMinute;
  const durationSeconds = durationMinutes * 60;
  
  // 至少给0.5秒，避免太短
  return Math.max(0.5, durationSeconds);
};

/**
 * 根据音频总时长和总单词数计算语速（词/分钟）
 * @param audioDurationSeconds 音频总时长（秒）
 * @param totalWords 总单词数
 * @returns 语速（词/分钟），如果超出范围则返回默认值
 */
const calculateWordsPerMinute = (audioDurationSeconds: number, totalWords: number): number => {
  if (totalWords === 0 || audioDurationSeconds === 0) {
    return DEFAULT_WPM;
  }
  
  // 语速 = 总单词数 / (音频时长(秒) / 60) = 词/分钟
  const wpm = totalWords / (audioDurationSeconds / 60);
  
  // 如果超出范围，使用默认值
  if (wpm < MIN_WPM || wpm > MAX_WPM) {
    console.log(`[WPM] 计算出的语速 ${wpm.toFixed(1)} 词/分钟 超出范围 [${MIN_WPM}, ${MAX_WPM}]，使用默认值 ${DEFAULT_WPM}`);
    return DEFAULT_WPM;
  }
  
  return Math.round(wpm);
};

interface SentenceItem {
  id: number;
  sentence_file_id: number;
  text: string;
  order_number: number;
  start_time: number | null;  // 秒
  end_time: number | null;    // 秒
  audio_url: string | null;
}

interface SentenceFile {
  id: number;
  title: string;
  original_audio_signed_url?: string;
  text_content: string | null;
  status: string;
  duration?: number;  // 秒
  original_duration?: number;  // 原始音频时长（毫秒）
}

export default function EditSentenceAudioScreen() {
  const { theme } = useTheme();
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ fileId?: number }>();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [file, setFile] = useState<SentenceFile | null>(null);
  const [sentences, setSentences] = useState<SentenceItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const [successDialog, setSuccessDialog] = useState<{ visible: boolean; message: string; onConfirm?: () => void }>({
    visible: false,
    message: '',
  });

  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; sentenceId: number | null }>({
    visible: false,
    sentenceId: null,
  });

  // 语速设置（词/分钟）
  const [wordsPerMinute, setWordsPerMinute] = useState(DEFAULT_WPM);
  const [showWpmModal, setShowWpmModal] = useState(false);
  const [wpmInput, setWpmInput] = useState(String(DEFAULT_WPM));
  
  // 总单词数（用于显示）
  const [totalWords, setTotalWords] = useState(0);

  // 文件列表（用于选择文件）
  const [fileList, setFileList] = useState<SentenceFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const currentSentence = sentences[currentIndex];

  // 加载文件列表
  const loadFileList = async () => {
    setLoadingList(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files`);
      const result = await response.json();
      
      if (result.files) {
        // 只显示有文本内容的文件（text_ready 或 completed 状态）
        const editableFiles = result.files.filter((f: SentenceFile) => 
          f.status === 'text_ready' || f.status === 'completed' || f.status === 'audio_ready'
        );
        setFileList(editableFiles);
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
    } finally {
      setLoadingList(false);
    }
  };

  // 如果有fileId参数，直接加载该文件；否则加载文件列表
  useEffect(() => {
    if (params.fileId) {
      loadFile(params.fileId);
    } else {
      loadFileList();
    }
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [params.fileId]);

  // 加载文件和句子数据
  const loadFile = async (fileId: number) => {
    setLoading(true);
    console.log('[loadFile] 开始加载文件, fileId:', fileId);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files/:id
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${fileId}`);
      const result = await response.json();

      console.log('[loadFile] API 返回结果:', JSON.stringify(result, null, 2).substring(0, 500));

      if (result.file) {
        setFile(result.file);
        console.log('[loadFile] 音频 URL:', result.file.original_audio_signed_url);
        console.log('[loadFile] 音频时长:', result.file.original_duration);

        // 设置音频时长（后端字段是 original_duration，单位是毫秒）
        if (result.file.original_duration) {
          setDuration(result.file.original_duration / 1000); // 转换为秒
        }

        // 如果已经有句子数据，加载它们
        if (result.file.sentences && result.file.sentences.length > 0) {
          // 计算总单词数
          const sentences = result.file.sentences;
          const wordsCount = sentences.reduce((sum: number, s: SentenceItem) => sum + countWords(s.text), 0);
          setTotalWords(wordsCount);
          
          // 获取音频总时长（秒），后端返回的是毫秒
          const audioTotalDuration = (result.file.original_duration || 0) / 1000;
          
          // 计算语速（词/分钟）
          const calculatedWpm = calculateWordsPerMinute(audioTotalDuration, wordsCount);
          setWordsPerMinute(calculatedWpm);
          setWpmInput(String(calculatedWpm));
          
          console.log(`[loadFile] 音频总时长: ${audioTotalDuration}s, 总单词数: ${wordsCount}, 语速: ${calculatedWpm} 词/分钟`);
          
          // 对句子进行时间预估处理
          const processedSentences = sentences.map((sentence: SentenceItem, index: number, arr: SentenceItem[]) => {
            // 如果已经保存过时间，保持不变
            if (sentence.start_time !== null && sentence.end_time !== null) {
              return sentence;
            }
            
            // 没有保存过时间，基于单词数计算预估时间
            const wordCount = countWords(sentence.text);
            const estimatedDuration = calculateEstimatedDuration(wordCount, calculatedWpm);
            
            // 开始时间：上一句的结束时间，或者0
            let startTime = 0;
            if (index > 0 && arr[index - 1].end_time !== null) {
              startTime = arr[index - 1].end_time!;
            }
            
            // 结束时间 = 开始时间 + 预估时长
            const endTime = startTime + estimatedDuration;
            
            return {
              ...sentence,
              start_time: startTime,
              end_time: endTime,
            };
          });
          
          setSentences(processedSentences);
          console.log('[loadFile] 加载已有句子:', processedSentences.length, '个');
        } else if (result.file.text_content) {
          // 从文本内容创建句子
          const lines = result.file.text_content.split(/\n\s*\n/);
          const filteredLines = lines.map((line: string) => line.trim()).filter((line: string) => line.length > 0);
          
          // 计算总单词数
          const wordsCount = filteredLines.reduce((sum: number, line: string) => sum + countWords(line), 0);
          setTotalWords(wordsCount);
          
          // 获取音频总时长（秒），后端返回的是毫秒
          const audioTotalDuration = (result.file.original_duration || 0) / 1000;
          
          // 计算语速（词/分钟）
          const calculatedWpm = calculateWordsPerMinute(audioTotalDuration, wordsCount);
          setWordsPerMinute(calculatedWpm);
          setWpmInput(String(calculatedWpm));
          
          console.log(`[loadFile] 音频总时长: ${audioTotalDuration}s, 总单词数: ${wordsCount}, 语速: ${calculatedWpm} 词/分钟`);
          
          let currentTime = 0;
          
          const newSentences = filteredLines.map((line: string, index: number) => {
            const wordCount = countWords(line);
            const estimatedDuration = calculateEstimatedDuration(wordCount, calculatedWpm);
            const sentence = {
              id: 0,
              sentence_file_id: fileId,
              text: line,
              order_number: index + 1,
              start_time: currentTime,
              end_time: currentTime + estimatedDuration,
              audio_url: null,
            };
            // 更新当前时间，供下一句使用
            currentTime = sentence.end_time;
            return sentence;
          });
          setSentences(newSentences);
          console.log('[loadFile] 从文本创建句子:', newSentences.length, '个');
        }
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (error) {
      console.error('[loadFile] 加载失败:', error);
      setErrorDialog({ visible: true, message: `加载失败：${(error as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  // 加载音频
  const loadAudio = async () => {
    console.log('[loadAudio] 开始加载音频');
    console.log('[loadAudio] file?.original_audio_signed_url:', file?.original_audio_signed_url ? '有值' : '无值');

    if (!file?.original_audio_signed_url) {
      console.error('[loadAudio] 没有音频 URL');
      return null;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      console.log('[loadAudio] 正在创建音频实例...');
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: file.original_audio_signed_url },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      console.log('[loadAudio] 音频实例创建成功');

      if (status.isLoaded) {
        const realDuration = (status.durationMillis || 0) / 1000; // 转换为秒
        setDuration(realDuration);
        console.log('[loadAudio] 音频时长:', realDuration, '秒');
        return realDuration;
      }
      return null;
    } catch (error) {
      console.error('[loadAudio] 加载音频失败:', error);
      return null;
    }
  };

  // 播放状态更新回调
  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded && status.didJustFinish) {
      setIsPlaying(false);
    }
  };

  // 停止播放
  const handleStopPlaying = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
        }
      }
      setIsPlaying(false);
    } catch (e) {
      console.log('停止播放失败:', e);
      setIsPlaying(false);
    }
  }, []);

  // 播放完整句子（开始时间到结束时间）
  const playFullSentence = async () => {
    console.log('[playFullSentence] 开始执行');
    console.log('[playFullSentence] currentSentence:', currentSentence?.text);
    console.log('[playFullSentence] start_time:', currentSentence?.start_time);
    console.log('[playFullSentence] end_time:', currentSentence?.end_time);

    // 加载音频
    if (!soundRef.current) {
      const loadedDuration = await loadAudio();
      if (!loadedDuration) {
        console.log('[playFullSentence] 音频加载失败');
        setErrorDialog({ visible: true, message: '音频加载失败，请检查网络连接' });
        return;
      }
    }

    if (!soundRef.current) {
      console.log('[playFullSentence] soundRef 为空');
      return;
    }

    await handleStopPlaying();

    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      console.log('[playFullSentence] 音频未加载');
      return;
    }

    const actualDurationMs = status.durationMillis || 0;
    let startMs: number;
    let endMs: number;

    // 根据是否有时间戳决定播放范围
    if (currentSentence?.start_time !== null && currentSentence?.start_time !== undefined &&
        currentSentence?.end_time !== null && currentSentence?.end_time !== undefined) {
      // 有时间戳：播放从开始到结束的片段
      startMs = currentSentence.start_time * 1000;
      endMs = currentSentence.end_time * 1000;
      console.log('[playFullSentence] 播放片段:', startMs, 'ms -', endMs, 'ms');
    } else {
      // 没有时间戳：从上一个句子结束位置或音频开头播放一小段
      if (currentIndex > 0 && sentences[currentIndex - 1]?.end_time) {
        startMs = sentences[currentIndex - 1].end_time! * 1000;
      } else {
        startMs = 0;
      }
      // 默认播放3秒
      endMs = Math.min(startMs + 3000, actualDurationMs);
      console.log('[playFullSentence] 无时间戳，从', startMs, 'ms 播放 3 秒');
    }

    // 确保时间戳在有效范围内
    startMs = Math.max(0, Math.min(startMs, actualDurationMs - 100));
    endMs = Math.max(startMs + 100, Math.min(endMs, actualDurationMs));

    if (endMs <= startMs) {
      console.log('[playFullSentence] 无效时间范围');
      return;
    }

    console.log('[playFullSentence] 最终播放范围:', startMs, 'ms -', endMs, 'ms');

    try {
      await soundRef.current.setPositionAsync(startMs);
      await soundRef.current.playAsync();
      setIsPlaying(true);

      const checkInterval = setInterval(async () => {
        if (!soundRef.current) {
          clearInterval(checkInterval);
          return;
        }
        const s = await soundRef.current.getStatusAsync();
        if (s.isLoaded && s.positionMillis >= endMs) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          clearInterval(checkInterval);
          console.log('[playFullSentence] 播放结束');
        }
      }, 50);
    } catch (e) {
      console.error('[playFullSentence] 播放失败:', e);
    }
  };

  // 播放从开始时间位置开始（如果没有开始时间，从音频开头播放）
  const playFromStart = async () => {
    console.log('[playFromStart] 开始执行');
    console.log('[playFromStart] currentSentence:', currentSentence?.text);
    console.log('[playFromStart] start_time:', currentSentence?.start_time);

    // 加载音频
    if (!soundRef.current) {
      const loadedDuration = await loadAudio();
      if (!loadedDuration) {
        console.log('[playFromStart] 音频加载失败');
        setErrorDialog({ visible: true, message: '音频加载失败，请检查网络连接' });
        return;
      }
    }

    if (!soundRef.current) {
      console.log('[playFromStart] soundRef 为空');
      return;
    }

    await handleStopPlaying();

    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      console.log('[playFromStart] 音频未加载');
      return;
    }

    // 如果有开始时间，从开始时间播放；否则从上一个句子的结束位置或音频开头播放
    let startMs = 0;
    if (currentSentence?.start_time !== null && currentSentence?.start_time !== undefined) {
      startMs = currentSentence.start_time * 1000;
    } else if (currentIndex > 0 && sentences[currentIndex - 1]?.end_time) {
      // 如果没有开始时间，使用上一句的结束时间
      startMs = sentences[currentIndex - 1].end_time! * 1000;
    }

    console.log('[playFromStart] 播放位置:', startMs, 'ms');
    await soundRef.current.setPositionAsync(startMs);
    await soundRef.current.playAsync();
    setIsPlaying(true);
  };

  // 播放从结束时间位置开始（用于预览结束位置）
  const playFromEnd = async () => {
    console.log('[playFromEnd] 开始执行');
    console.log('[playFromEnd] end_time:', currentSentence?.end_time);

    // 加载音频
    if (!soundRef.current) {
      const loadedDuration = await loadAudio();
      if (!loadedDuration) {
        console.log('[playFromEnd] 音频加载失败');
        setErrorDialog({ visible: true, message: '音频加载失败，请检查网络连接' });
        return;
      }
    }

    if (!soundRef.current) {
      console.log('[playFromEnd] soundRef 为空');
      return;
    }

    await handleStopPlaying();

    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      console.log('[playFromEnd] 音频未加载');
      return;
    }

    // 如果有结束时间，从结束时间播放；否则从开始时间播放
    let positionMs = 0;
    if (currentSentence?.end_time !== null && currentSentence?.end_time !== undefined) {
      positionMs = currentSentence.end_time * 1000;
    } else if (currentSentence?.start_time !== null && currentSentence?.start_time !== undefined) {
      positionMs = currentSentence.start_time * 1000;
    }

    console.log('[playFromEnd] 播放位置:', positionMs, 'ms');
    await soundRef.current.setPositionAsync(positionMs);
    await soundRef.current.playAsync();
    setIsPlaying(true);
  };

  // 调整开始时间
  const handleStartTimeChange = (deltaMs: number) => {
    if (!currentSentence) return;

    const deltaSeconds = deltaMs / 1000;
    const newStartTime = Math.max(0, (currentSentence.start_time || 0) + deltaSeconds);

    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      start_time: newStartTime,
    };
    setSentences(newSentences);
  };

  // 调整结束时间
  const handleEndTimeChange = (deltaMs: number) => {
    if (!currentSentence) return;

    const deltaSeconds = deltaMs / 1000;
    const minEnd = (currentSentence.start_time || 0) + 0.01; // 最少10ms
    const newEndTime = Math.max(minEnd, (currentSentence.end_time || 0) + deltaSeconds);

    const newSentences = [...sentences];
    newSentences[currentIndex] = {
      ...newSentences[currentIndex],
      end_time: newEndTime,
    };
    setSentences(newSentences);
  };

  // 确认并跳转下一句，同时自动调整下一句的开始时间和预估结束时间
  const confirmAndNext = () => {
    if (currentIndex < sentences.length - 1) {
      const nextIndex = currentIndex + 1;
      const currentEnd = currentSentence?.end_time;

      if (currentEnd) {
        // 下一句的开始时间 = 当前句子的结束时间
        const newSentences = [...sentences];
        const nextSentence = newSentences[nextIndex];
        
        // 计算预估时长（基于单词数和语速）
        const wordCount = countWords(nextSentence.text);
        const estimatedDuration = calculateEstimatedDuration(wordCount, wordsPerMinute);
        
        newSentences[nextIndex] = {
          ...nextSentence,
          start_time: currentEnd,
          // 如果下一句还没有结束时间，或者结束时间小于新的开始时间，设置预估结束时间
          end_time: nextSentence.end_time && nextSentence.end_time > currentEnd 
            ? nextSentence.end_time 
            : currentEnd + estimatedDuration,
        };
        setSentences(newSentences);
        console.log(`自动设置第 ${nextIndex + 1} 句: 开始=${currentEnd}s, 预估结束=${newSentences[nextIndex].end_time}s`);
      }

      setCurrentIndex(nextIndex);
    } else {
      setSuccessDialog({
        visible: true,
        message: '已完成所有句子的时间轴设置！\n\n点击「保存」保存进度\n点击「完成切分」生成语音片段',
      });
    }
  };

  // 上一句
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 下一句
  const goToNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // 删除当前句子
  const handleDeleteSentence = useCallback(() => {
    if (!currentSentence) {
      setErrorDialog({ visible: true, message: '没有选中要删除的句子' });
      return;
    }

    setDeleteConfirm({ visible: true, sentenceId: currentSentence.id });
  }, [currentSentence]);

  // 执行删除操作
  const executeDelete = useCallback(async () => {
    if (!deleteConfirm.sentenceId || !file) return;

    try {
      // 如果句子有ID，调用后端删除
      if (deleteConfirm.sentenceId > 0) {
        const res = await fetch(
          `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/sentences/${deleteConfirm.sentenceId}`,
          { method: 'DELETE' }
        );

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || '删除失败');
        }
      }

      // 从本地列表中移除
      const newSentences = sentences.filter((_, idx) => idx !== currentIndex);
      setSentences(newSentences);

      // 调整当前索引
      if (currentIndex >= newSentences.length) {
        setCurrentIndex(Math.max(0, newSentences.length - 1));
      }

      setSuccessDialog({ visible: true, message: '句子已删除' });
    } catch (e) {
      setErrorDialog({ visible: true, message: `删除失败: ${(e as Error).message}` });
    }

    setDeleteConfirm({ visible: false, sentenceId: null });
  }, [deleteConfirm.sentenceId, file, sentences, currentIndex]);

  // 保存时间戳数据
  const handleSave = async () => {
    if (!file) {
      setErrorDialog({ visible: true, message: '请先加载文件' });
      return;
    }

    setSaving(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：POST /api/v1/sentence-files/:id/sentences
       * Path 参数：id: number
       * Body 参数：sentences: Array<{ text: string, order_number: number, start_time?: number, end_time?: number }>
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/sentences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences }),
      });

      const result = await response.json();

      if (result.success) {
        // 重新加载数据以获取服务端生成的ID
        loadFile(file.id);
        setSuccessDialog({ visible: true, message: '保存成功！' });
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `保存失败：${(error as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  // 生成句子语音片段
  const handleFinalize = async () => {
    if (!file) {
      setErrorDialog({ visible: true, message: '请先加载文件' });
      return;
    }

    // 检查是否所有句子都有时间戳
    const invalidSentences = sentences.filter(
      s => s.start_time === null || s.end_time === null || s.end_time <= s.start_time
    );
    if (invalidSentences.length > 0) {
      setErrorDialog({
        visible: true,
        message: `有 ${invalidSentences.length} 个句子时间戳无效，请先调整时间轴`,
      });
      return;
    }

    setProcessing(true);
    try {
      // 先保存
      const saveResponse = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/sentences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences }),
      });
      const saveResult = await saveResponse.json();
      if (!saveResult.success) {
        throw new Error(saveResult.error || '保存失败');
      }

      // 再生成音频
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：POST /api/v1/sentence-files/:id/generate-audio
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${file.id}/generate-audio`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setSuccessDialog({
          visible: true,
          message: `语音片段生成成功！\n成功处理 ${result.processedCount || sentences.length} 个句子\n\n句库制作完成！`,
          onConfirm: () => router.back(),
        });
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error) {
      setErrorDialog({ visible: true, message: `生成失败：${(error as Error).message}` });
    } finally {
      setProcessing(false);
    }
  };

  // 格式化时间（秒 -> m:ss.SS）
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '0:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
  };

  // 计算时长
  const sentenceDuration = currentSentence && currentSentence.start_time !== null && currentSentence.end_time !== null
    ? currentSentence.end_time - currentSentence.start_time
    : 0;

  // 计算预估时长（基于单词数和语速）
  const wordCount = currentSentence ? countWords(currentSentence.text) : 0;
  const estimatedDuration = currentSentence ? calculateEstimatedDuration(wordCount, wordsPerMinute) : 0;

  const hasValidTime = currentSentence && currentSentence.start_time !== null && currentSentence.end_time !== null && currentSentence.end_time > currentSentence.start_time;

  // 更新语速设置
  const handleWpmChange = () => {
    const newWpm = parseInt(wpmInput, 10);
    if (isNaN(newWpm) || newWpm < MIN_WPM || newWpm > MAX_WPM) {
      Alert.alert('无效输入', `请输入 ${MIN_WPM} 到 ${MAX_WPM} 之间的数字`);
      return;
    }
    setWordsPerMinute(newWpm);
    
    // 更新当前句子的时长
    if (currentSentence) {
      const wordCount = countWords(currentSentence.text);
      const newDuration = calculateEstimatedDuration(wordCount, newWpm);
      
      // 更新当前句子的结束时间
      const newSentences = [...sentences];
      newSentences[currentIndex] = {
        ...currentSentence,
        start_time: currentSentence.start_time ?? 0,
        end_time: (currentSentence.start_time ?? 0) + newDuration,
      };
      setSentences(newSentences);
    }
    
    setShowWpmModal(false);
    console.log(`[WPM] 语速更新为: ${newWpm} 词/分钟，已更新当前句子时长`);
  };

  // 根据新语速重新分配所有时间
  const redistributeTimeByWpm = (newWpm: number) => {
    let currentTime = 0;
    const newSentences = sentences.map((sentence) => {
      const wordCount = countWords(sentence.text);
      const estimatedDuration = calculateEstimatedDuration(wordCount, newWpm);
      const newSentence = {
        ...sentence,
        start_time: currentTime,
        end_time: currentTime + estimatedDuration,
      };
      currentTime = newSentence.end_time;
      return newSentence;
    });
    setSentences(newSentences);
  };

  // 加载中
  if (loading || loadingList) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={{ color: '#888', marginTop: 16 }}>正在加载...</Text>
        </ThemedView>
      </Screen>
    );
  }

  // 没有指定文件ID，显示文件列表让用户选择
  if (!params.fileId && fileList.length > 0) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        {/* 顶部状态栏 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>选择文件</Text>
            <Text style={styles.headerInfo}>请选择要编辑的文件</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <FontAwesome6 name="xmark" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* 文件列表 */}
        <View style={{ flex: 1, padding: 16 }}>
          {fileList.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2a2a2a',
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
              }}
              onPress={() => router.push('/edit-sentence-audio', { fileId: item.id })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#00ff8820',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <FontAwesome6 name="music" size={18} color="#00ff88" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                  {item.status === 'text_ready' ? '待设置时间轴' : 
                   item.status === 'audio_ready' ? '时间轴已设置' : 
                   item.status === 'completed' ? '已完成' : item.status}
                </Text>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color="#666" />
            </TouchableOpacity>
          ))}
        </View>
      </Screen>
    );
  }

  // 没有文件
  if (!file || sentences.length === 0) {
    return (
      <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
          <FontAwesome6 name="folder-open" size={48} color="#666" />
          <Text style={{ color: '#888', marginTop: 16, textAlign: 'center', paddingHorizontal: 32 }}>
            {fileList.length === 0 ? '没有可编辑的文件\n请先上传音频并编辑文本' : '文件数据为空'}
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 24, padding: 16, backgroundColor: '#00ff88', borderRadius: 8 }} 
            onPress={() => router.push('/create-sentence-file')}
          >
            <Text style={{ color: '#000', fontWeight: '600' }}>去上传</Text>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#1a1a1a" statusBarStyle="light">
      {/* 顶部状态栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>时间轴编辑</Text>
          <Text style={styles.headerInfo}>句子 {currentIndex + 1}/{sentences.length}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <FontAwesome6 name="xmark" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* 句子导航 */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={goToPrevious}
        >
          <FontAwesome6 name="chevron-left" size={16} color={currentIndex === 0 ? '#444' : '#00ff88'} />
        </TouchableOpacity>

        <View style={styles.sentenceBox}>
          <Text style={styles.sentenceText}>{currentSentence?.text}</Text>
        </View>

        <TouchableOpacity
          style={[styles.navBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
          onPress={goToNext}
        >
          <FontAwesome6 name="chevron-right" size={16} color={currentIndex === sentences.length - 1 ? '#444' : '#00ff88'} />
        </TouchableOpacity>
      </View>

      {/* 时间调整区域 */}
      <View style={styles.dialSection}>
        {/* 开始时间 */}
        <TimeControl
          value={(currentSentence?.start_time || 0) * 1000} // 转换为毫秒
          onChange={handleStartTimeChange}
          onPlay={playFullSentence}
          label="开始"
          color="#00ff88"
        />

        {/* 时长 */}
        <View style={styles.durationRow}>
          <View style={styles.durationDivider} />
          <View style={styles.durationBox}>
            <Text style={styles.durationLabel}>时长</Text>
            <Text style={styles.durationValue}>
              {hasValidTime ? formatTime(sentenceDuration) : '--:--.--'}
            </Text>
            <Text style={styles.durationHintTextSmall}>
              {wordCount} 词 / 预估 {formatTime(estimatedDuration)}
            </Text>
          </View>
          <View style={styles.durationDivider} />
        </View>

        {/* 语速设置 */}
        <TouchableOpacity 
          style={styles.wpmRow}
          onPress={() => setShowWpmModal(true)}
        >
          <FontAwesome6 name="gauge" size={14} color="#666" />
          <Text style={styles.wpmText}>
            语速: {wordsPerMinute} 词/分钟
          </Text>
          <FontAwesome6 name="pencil" size={12} color="#666" />
        </TouchableOpacity>

        {/* 结束时间 */}
        <TimeControl
          value={(currentSentence?.end_time || 0) * 1000} // 转换为毫秒
          onChange={handleEndTimeChange}
          onPlay={playFullSentence}
          label="结束"
          color="#ff8800"
        />
      </View>

      {/* 音频时长提示 */}
      <View style={styles.durationHint}>
        <FontAwesome6 name="clock" size={14} color="#666" />
        <Text style={styles.durationHintText}>
          音频总时长: {formatTime(duration)}
        </Text>
      </View>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteSentence}
        >
          <FontAwesome6 name="trash" size={16} color="#ff4444" />
          <Text style={styles.deleteBtnText}>删除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.stopBtn, isPlaying && styles.stopBtnActive]}
          onPress={handleStopPlaying}
          disabled={!isPlaying}
        >
          <FontAwesome6 name="stop" size={16} color={isPlaying ? '#fff' : '#444'} />
          <Text style={[styles.stopBtnText, isPlaying && styles.stopBtnTextActive]}>停止</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <FontAwesome6 name="floppy-disk" size={16} color="#000" />
              <Text style={styles.saveBtnText}>保存</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={confirmAndNext}
        >
          <FontAwesome6 name="check" size={16} color="#000" />
          <Text style={styles.confirmBtnText}>{currentIndex < sentences.length - 1 ? '下一句' : '完成'}</Text>
        </TouchableOpacity>
      </View>

      {/* 完成切分按钮 */}
      <View style={styles.finalizeSection}>
        <TouchableOpacity
          style={[styles.finalizeBtn, processing && styles.finalizeBtnDisabled]}
          onPress={handleFinalize}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <FontAwesome6 name="wand-magic-sparkles" size={18} color="#fff" />
              <Text style={styles.finalizeBtnText}>完成切分并生成语音</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Dialogs */}
      <ConfirmDialog
        visible={errorDialog.visible}
        title="错误"
        message={errorDialog.message}
        confirmText="确定"
        onConfirm={() => setErrorDialog({ visible: false, message: '' })}
        onCancel={() => setErrorDialog({ visible: false, message: '' })}
      />

      <ConfirmDialog
        visible={successDialog.visible}
        title="成功"
        message={successDialog.message}
        confirmText="确定"
        onConfirm={() => {
          setSuccessDialog({ visible: false, message: '' });
          successDialog.onConfirm?.();
        }}
        onCancel={() => {
          setSuccessDialog({ visible: false, message: '' });
          successDialog.onConfirm?.();
        }}
      />

      <ConfirmDialog
        visible={deleteConfirm.visible}
        title="确认删除"
        message={`确定要删除这个句子吗？\n\n"${currentSentence?.text?.substring(0, 30)}${(currentSentence?.text?.length || 0) > 30 ? '...' : ''}"`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirm({ visible: false, sentenceId: null })}
      />

      {/* 语速设置弹窗 */}
      <Modal
        visible={showWpmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWpmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置语速</Text>
            <Text style={styles.modalHint}>
              根据音频总时长 ({formatTime(duration)}) 和总单词数 ({totalWords}) 计算
            </Text>
            <Text style={styles.modalHint}>
              建议: {MIN_WPM} - {MAX_WPM} 词/分钟
            </Text>
            
            <TextInput
              style={styles.wpmInput}
              value={wpmInput}
              onChangeText={setWpmInput}
              keyboardType="numeric"
              placeholder={`${MIN_WPM}-${MAX_WPM}`}
              placeholderTextColor="#666"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setShowWpmModal(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn}
                onPress={handleWpmChange}
              >
                <Text style={styles.modalConfirmText}>应用当前句</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.redistributeBtn}
              onPress={() => {
                const newWpm = parseInt(wpmInput, 10);
                if (!isNaN(newWpm) && newWpm >= MIN_WPM && newWpm <= MAX_WPM) {
                  setWordsPerMinute(newWpm);
                  redistributeTimeByWpm(newWpm);
                  setShowWpmModal(false);
                  console.log(`[WPM] 重新分配所有时间，语速: ${newWpm} 词/分钟`);
                }
              }}
            >
              <Text style={styles.redistributeBtnText}>重新分配所有句子</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 顶部状态栏
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1a1a1a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerInfo: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 句子导航
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00ff8820',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  sentenceBox: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sentenceText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // 时间调整区域
  dialSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },

  // 时长显示
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  durationDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  durationBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  durationLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  durationValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  durationHintTextSmall: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },

  // 语速设置
  wpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  wpmText: {
    color: '#666',
    fontSize: 12,
  },

  // 音频时长提示
  durationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  durationHintText: {
    color: '#666',
    fontSize: 12,
  },

  // 底部操作栏
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    gap: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ff444420',
  },
  deleteBtnText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '500',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  stopBtnActive: {
    backgroundColor: '#666',
  },
  stopBtnText: {
    color: '#444',
    fontSize: 14,
    fontWeight: '500',
  },
  stopBtnTextActive: {
    color: '#fff',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#00ff88',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#00ff88',
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },

  // 完成切分按钮
  finalizeSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#00ff88',
  },
  finalizeBtnDisabled: {
    opacity: 0.6,
  },
  finalizeBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },

  // 语速设置弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalHint: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  wpmInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
    marginTop: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#444',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#00ff88',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  redistributeBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    alignItems: 'center',
  },
  redistributeBtnText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
});
