import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  COMPLETED_SENTENCES: 'completed_sentences',
  ERROR_WORDS: 'error_words',
  CACHED_AUDIO: 'cached_audio',
  SENTENCE_ERRORS: 'sentence_errors', // 记录每个句子的错误次数
  LAST_LEARNING_POSITION: 'last_learning_position', // 最后学习位置
};

// 已完成句子记录
interface CompletedSentence {
  materialId: number;
  sentenceId: number;
  completedAt: number; // timestamp
}

// 错题记录
interface ErrorWord {
  word: string;
  count: number; // 错误次数
  lastErrorAt: number;
  sentenceText?: string; // 所在句子
}

// 句子错误记录（用于难度分级）
interface SentenceErrorRecord {
  materialId: number;
  sentenceId: number;
  errorCount: number; // 总错误次数
  attemptCount: number; // 尝试次数
}

// 最后学习位置记录
export interface LastLearningPosition {
  courseId: number;
  courseTitle: string;
  lessonId: number;
  lessonNumber: number;
  lessonTitle: string;
  updatedAt: number;
}

// ============ 进度持久化 ============

/**
 * 标记句子为已完成
 */
export async function markSentenceCompleted(materialId: number, sentenceId: number): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_SENTENCES);
    const completed: CompletedSentence[] = data ? JSON.parse(data) : [];
    
    // 检查是否已存在
    const exists = completed.some(
      c => c.materialId === materialId && c.sentenceId === sentenceId
    );
    
    if (!exists) {
      completed.push({
        materialId,
        sentenceId,
        completedAt: Date.now(),
      });
      await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_SENTENCES, JSON.stringify(completed));
    }
  } catch (e) {
    console.error('保存进度失败:', e);
  }
}

/**
 * 获取材料的已完成句子ID列表
 */
export async function getCompletedSentences(materialId: number): Promise<number[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_SENTENCES);
    const completed: CompletedSentence[] = data ? JSON.parse(data) : [];
    
    return completed
      .filter(c => c.materialId === materialId)
      .map(c => c.sentenceId);
  } catch (e) {
    console.error('读取进度失败:', e);
    return [];
  }
}

/**
 * 检查句子是否已完成
 */
export async function isSentenceCompleted(materialId: number, sentenceId: number): Promise<boolean> {
  const completed = await getCompletedSentences(materialId);
  return completed.includes(sentenceId);
}

/**
 * 清除材料的学习进度
 */
export async function clearMaterialProgress(materialId: number): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_SENTENCES);
    const completed: CompletedSentence[] = data ? JSON.parse(data) : [];
    
    const filtered = completed.filter(c => c.materialId !== materialId);
    await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_SENTENCES, JSON.stringify(filtered));
  } catch (e) {
    console.error('清除进度失败:', e);
  }
}

// ============ 错题本 ============

/**
 * 记录错误单词
 */
export async function recordErrorWord(word: string, sentenceText?: string): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ERROR_WORDS);
    const errors: ErrorWord[] = data ? JSON.parse(data) : [];
    
    const existing = errors.find(e => e.word.toLowerCase() === word.toLowerCase());
    
    if (existing) {
      existing.count += 1;
      existing.lastErrorAt = Date.now();
      if (sentenceText) existing.sentenceText = sentenceText;
    } else {
      errors.push({
        word: word.toLowerCase(),
        count: 1,
        lastErrorAt: Date.now(),
        sentenceText,
      });
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.ERROR_WORDS, JSON.stringify(errors));
  } catch (e) {
    console.error('记录错题失败:', e);
  }
}

/**
 * 获取错题列表（按错误次数排序）
 */
export async function getErrorWords(limit?: number): Promise<ErrorWord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ERROR_WORDS);
    const errors: ErrorWord[] = data ? JSON.parse(data) : [];
    
    // 按错误次数降序排序
    const sorted = errors.sort((a, b) => b.count - a.count);
    
    return limit ? sorted.slice(0, limit) : sorted;
  } catch (e) {
    console.error('读取错题失败:', e);
    return [];
  }
}

/**
 * 清除某个单词的错题记录
 */
export async function clearErrorWord(word: string): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ERROR_WORDS);
    const errors: ErrorWord[] = data ? JSON.parse(data) : [];
    
    const filtered = errors.filter(e => e.word.toLowerCase() !== word.toLowerCase());
    await AsyncStorage.setItem(STORAGE_KEYS.ERROR_WORDS, JSON.stringify(filtered));
  } catch (e) {
    console.error('清除错题失败:', e);
  }
}

/**
 * 清空所有错题
 */
export async function clearAllErrorWords(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ERROR_WORDS);
  } catch (e) {
    console.error('清空错题失败:', e);
  }
}

// ============ 难度分级 ============

/**
 * 记录句子错误（用于难度计算）
 */
export async function recordSentenceError(materialId: number, sentenceId: number): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SENTENCE_ERRORS);
    const records: SentenceErrorRecord[] = data ? JSON.parse(data) : [];
    
    const existing = records.find(
      r => r.materialId === materialId && r.sentenceId === sentenceId
    );
    
    if (existing) {
      existing.errorCount += 1;
    } else {
      records.push({
        materialId,
        sentenceId,
        errorCount: 1,
        attemptCount: 1,
      });
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.SENTENCE_ERRORS, JSON.stringify(records));
  } catch (e) {
    console.error('记录句子错误失败:', e);
  }
}

/**
 * 记录句子尝试（用于计算错误率）
 */
export async function recordSentenceAttempt(materialId: number, sentenceId: number): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SENTENCE_ERRORS);
    const records: SentenceErrorRecord[] = data ? JSON.parse(data) : [];
    
    const existing = records.find(
      r => r.materialId === materialId && r.sentenceId === sentenceId
    );
    
    if (existing) {
      existing.attemptCount += 1;
    }
    // 如果不存在，说明是第一次尝试且没有错误，不需要创建记录
    
    await AsyncStorage.setItem(STORAGE_KEYS.SENTENCE_ERRORS, JSON.stringify(records));
  } catch (e) {
    console.error('记录句子尝试失败:', e);
  }
}

/**
 * 获取句子的错误率
 */
export async function getSentenceErrorRate(materialId: number, sentenceId: number): Promise<number> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SENTENCE_ERRORS);
    const records: SentenceErrorRecord[] = data ? JSON.parse(data) : [];
    
    const record = records.find(
      r => r.materialId === materialId && r.sentenceId === sentenceId
    );
    
    if (!record || record.attemptCount === 0) return 0;
    
    return record.errorCount / record.attemptCount;
  } catch (e) {
    return 0;
  }
}

/**
 * 根据错误率获取建议的播放速度
 * 错误率高 -> 减速
 * 错误率低 -> 正常或加速
 */
export async function getSuggestedPlaybackRate(materialId: number, sentenceId: number): Promise<number> {
  const errorRate = await getSentenceErrorRate(materialId, sentenceId);
  
  if (errorRate >= 0.5) {
    return 0.75; // 高错误率，减速
  } else if (errorRate >= 0.3) {
    return 0.9; // 中等错误率，轻微减速
  } else if (errorRate <= 0.1) {
    return 1.1; // 低错误率，可加速
  }
  
  return 1.0; // 正常速度
}

// ============ 音频缓存（离线模式） ============

import * as FileSystem from 'expo-file-system/legacy';

interface CachedAudio {
  sentenceId: number;
  localUri: string;
  cachedAt: number;
}

/**
 * 下载并缓存音频
 */
export async function cacheAudio(sentenceId: number, remoteUrl: string): Promise<string | null> {
  try {
    // 检查是否已缓存
    const cached = await getCachedAudio(sentenceId);
    if (cached) return cached;
    
    // 下载音频 - 使用 cacheDirectory 作为存储位置
    const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
    if (!cacheDir) {
      console.error('无法获取缓存目录');
      return null;
    }
    
    const localUri = `${cacheDir}audio_${sentenceId}.m4a`;
    
    const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri);
    
    if (downloadResult.uri) {
      // 保存缓存记录
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_AUDIO);
      const cachedList: CachedAudio[] = data ? JSON.parse(data) : [];
      
      cachedList.push({
        sentenceId,
        localUri: downloadResult.uri,
        cachedAt: Date.now(),
      });
      
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_AUDIO, JSON.stringify(cachedList));
      
      return downloadResult.uri;
    }
    
    return null;
  } catch (e) {
    console.error('缓存音频失败:', e);
    return null;
  }
}

/**
 * 获取缓存的音频URI
 */
export async function getCachedAudio(sentenceId: number): Promise<string | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_AUDIO);
    const cachedList: CachedAudio[] = data ? JSON.parse(data) : [];
    
    const cached = cachedList.find(c => c.sentenceId === sentenceId);
    
    if (cached) {
      // 验证文件是否存在
      const info = await FileSystem.getInfoAsync(cached.localUri);
      if (info.exists) {
        return cached.localUri;
      } else {
        // 文件不存在，移除缓存记录
        const filtered = cachedList.filter(c => c.sentenceId !== sentenceId);
        await AsyncStorage.setItem(STORAGE_KEYS.CACHED_AUDIO, JSON.stringify(filtered));
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 批量缓存材料的所有音频
 */
export async function cacheMaterialAudio(
  sentences: Array<{ id: number; audio_url: string | null }>,
  getAudioUrl: (audioKey: string) => Promise<string>
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const sentence of sentences) {
    if (!sentence.audio_url) continue;
    
    try {
      const remoteUrl = await getAudioUrl(sentence.audio_url);
      const result = await cacheAudio(sentence.id, remoteUrl);
      
      if (result) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * 清除所有音频缓存
 */
export async function clearAllAudioCache(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_AUDIO);
    const cachedList: CachedAudio[] = data ? JSON.parse(data) : [];
    
    // 删除所有文件
    for (const cached of cachedList) {
      try {
        await FileSystem.deleteAsync(cached.localUri, { idempotent: true });
      } catch (e) {}
    }
    
    // 清除记录
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_AUDIO);
  } catch (e) {
    console.error('清除音频缓存失败:', e);
  }
}

/**
 * 获取缓存大小（字节）
 */
export async function getAudioCacheSize(): Promise<number> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_AUDIO);
    const cachedList: CachedAudio[] = data ? JSON.parse(data) : [];
    
    let totalSize = 0;
    
    for (const cached of cachedList) {
      const info = await FileSystem.getInfoAsync(cached.localUri);
      if (info.exists && 'size' in info) {
        totalSize += info.size;
      }
    }
    
    return totalSize;
  } catch (e) {
    return 0;
  }
}

// ============ 最后学习位置 ============

/**
 * 保存最后学习位置
 */
export async function saveLastLearningPosition(position: LastLearningPosition): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_LEARNING_POSITION, JSON.stringify(position));
  } catch (e) {
    console.error('保存学习位置失败:', e);
  }
}

/**
 * 获取最后学习位置
 */
export async function getLastLearningPosition(): Promise<LastLearningPosition | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LEARNING_POSITION);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('获取学习位置失败:', e);
    return null;
  }
}

/**
 * 清除最后学习位置
 */
export async function clearLastLearningPosition(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_LEARNING_POSITION);
  } catch (e) {
    console.error('清除学习位置失败:', e);
  }
}
