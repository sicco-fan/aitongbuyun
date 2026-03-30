/**
 * 本地音频存储工具
 * 用于将生成的音频保存到用户设备本地，不占用云端空间
 * 
 * 注意：Web 端不支持本地文件存储，相关功能会返回默认值
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// 使用 as any 绕过 legacy 版本的类型限制
const FS = FileSystem as any;

/**
 * 检查是否在支持本地存储的平台
 */
export function isLocalStorageSupported(): boolean {
  return Platform.OS !== 'web' && !!FS.documentDirectory;
}

/**
 * 获取音频目录路径
 */
function getAudioDir(): string {
  return `${FS.documentDirectory || ''}audio_cache/`;
}

/**
 * 确保音频目录存在
 */
async function ensureAudioDir(): Promise<void> {
  if (!isLocalStorageSupported()) return;
  
  const AUDIO_DIR = getAudioDir();
  const dirInfo = await FS.getInfoAsync(AUDIO_DIR);
  if (!dirInfo.exists) {
    await FS.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
}

/**
 * 保存音频到本地
 * @param key 音频唯一标识（如：course_3_lesson_538_sentence_0）
 * @param base64Data Base64编码的音频数据
 * @returns 本地文件URI
 */
export async function saveAudioToLocal(key: string, base64Data: string): Promise<string> {
  if (!isLocalStorageSupported()) {
    console.log('[本地存储] Web端不支持本地存储');
    return '';
  }
  
  await ensureAudioDir();
  
  const AUDIO_DIR = getAudioDir();
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  await FS.writeAsStringAsync(filePath, base64Data, {
    encoding: 'base64',
  });
  
  console.log(`[本地存储] 音频已保存: ${filePath}`);
  return filePath;
}

/**
 * 从本地读取音频
 * @param key 音频唯一标识
 * @returns 本地文件URI，如果不存在返回null
 */
export async function getAudioFromLocal(key: string): Promise<string | null> {
  if (!isLocalStorageSupported()) {
    return null;
  }
  
  const AUDIO_DIR = getAudioDir();
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  try {
    const fileInfo = await FS.getInfoAsync(filePath);
    if (fileInfo.exists) {
      return filePath;
    }
  } catch (e) {
    // 忽略错误
  }
  
  return null;
}

/**
 * 检查音频是否已存在于本地
 * @param key 音频唯一标识
 */
export async function hasAudioLocal(key: string): Promise<boolean> {
  if (!isLocalStorageSupported()) {
    return false;
  }
  
  const AUDIO_DIR = getAudioDir();
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  try {
    const fileInfo = await FS.getInfoAsync(filePath);
    return fileInfo.exists;
  } catch (e) {
    return false;
  }
}

/**
 * 检查课程句子的音频是否存在（支持任意音色）
 * 检查 key 或 key_* 格式的文件是否存在
 * @param baseKey 基础 key（不含 voiceId）
 */
export async function hasCourseAudioLocal(baseKey: string): Promise<boolean> {
  if (!isLocalStorageSupported()) {
    return false;
  }
  
  const AUDIO_DIR = getAudioDir();
  
  try {
    // 先检查精确匹配（旧格式，不带 voiceId）
    const exactPath = `${AUDIO_DIR}${baseKey}.mp3`;
    const exactInfo = await FS.getInfoAsync(exactPath);
    if (exactInfo.exists) {
      return true;
    }
    
    // 检查是否有带 voiceId 的文件（新格式：baseKey_voiceId.mp3）
    const files = await FS.readDirectoryAsync(AUDIO_DIR);
    const prefix = `${baseKey}_`;
    const hasMatchingFile = files.some((file: string) => 
      file.startsWith(prefix) && file.endsWith('.mp3')
    );
    return hasMatchingFile;
  } catch (e) {
    return false;
  }
}

/**
 * 删除本地音频
 * @param key 音频唯一标识
 */
export async function deleteAudioFromLocal(key: string): Promise<void> {
  if (!isLocalStorageSupported()) {
    return;
  }
  
  const AUDIO_DIR = getAudioDir();
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  try {
    const fileInfo = await FS.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FS.deleteAsync(filePath);
    }
  } catch (e) {
    // 忽略错误
  }
}

/**
 * 获取本地音频缓存大小
 */
export async function getAudioCacheSize(): Promise<number> {
  if (!isLocalStorageSupported()) {
    return 0;
  }
  
  await ensureAudioDir();
  
  const AUDIO_DIR = getAudioDir();
  
  try {
    const files = await FS.readDirectoryAsync(AUDIO_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = `${AUDIO_DIR}${file}`;
      const fileInfo = await FS.getInfoAsync(filePath);
      if (fileInfo.exists && 'size' in fileInfo) {
        totalSize += fileInfo.size || 0;
      }
    }
    
    return totalSize;
  } catch (e) {
    return 0;
  }
}

/**
 * 清除所有本地音频缓存
 */
export async function clearAudioCache(): Promise<void> {
  if (!isLocalStorageSupported()) {
    return;
  }
  
  const AUDIO_DIR = getAudioDir();
  
  try {
    const dirInfo = await FS.getInfoAsync(AUDIO_DIR);
    if (dirInfo.exists) {
      await FS.deleteAsync(AUDIO_DIR);
    }
  } catch (e) {
    // 忽略错误
  }
}

/**
 * 生成课程句子的音频存储key
 * @param courseId 课程ID
 * @param lessonId 课时ID
 * @param sentenceIndex 句子索引
 * @param voiceId 音色ID（可选，用于区分不同音色的缓存）
 */
export function generateCourseAudioKey(
  courseId: number,
  lessonId: number,
  sentenceIndex: number,
  voiceId?: string
): string {
  if (voiceId) {
    return `course_${courseId}_lesson_${lessonId}_sentence_${sentenceIndex}_${voiceId}`;
  }
  return `course_${courseId}_lesson_${lessonId}_sentence_${sentenceIndex}`;
}

/**
 * 生成句库句子的音频存储key
 */
export function generateFileAudioKey(fileId: number, sentenceIndex: number): string {
  return `file_${fileId}_sentence_${sentenceIndex}`;
}

/**
 * 批量检查多个音频是否存在
 * @param keys 音频标识数组
 * @returns 已存在的数量
 */
export async function checkAudiosExist(keys: string[]): Promise<{ cached: number; total: number }> {
  if (!isLocalStorageSupported()) {
    return { cached: 0, total: keys.length };
  }
  
  let cached = 0;
  for (const key of keys) {
    if (await hasAudioLocal(key)) {
      cached++;
    }
  }
  return { cached, total: keys.length };
}

/**
 * 检查课时音频缓存状态
 * @param courseId 课程ID
 * @param lessonId 课时ID
 * @param sentenceCount 句子数量
 * @returns 缓存状态
 */
export async function checkLessonAudioStatus(
  courseId: number,
  lessonId: number,
  sentenceCount: number
): Promise<{ cached: number; total: number }> {
  let cached = 0;
  for (let i = 1; i <= sentenceCount; i++) {
    // 使用基础 key（不含 voiceId），支持检查任意音色的缓存
    const baseKey = `course_${courseId}_lesson_${lessonId}_sentence_${i}`;
    if (await hasCourseAudioLocal(baseKey)) {
      cached++;
    }
  }
  return { cached, total: sentenceCount };
}

/**
 * 检查课程所有课时的音频缓存状态
 * @param courseId 课程ID
 * @param lessons 课时列表 [{ id, sentence_count }]
 * @returns 总缓存状态
 */
export async function checkCourseAudioStatus(
  courseId: number,
  lessons: Array<{ id: number; sentence_count?: number; sentences_count?: number }>
): Promise<{ cached: number; total: number }> {
  if (!isLocalStorageSupported()) {
    // Web 端返回 0，不显示缓存状态
    return { cached: 0, total: 0 };
  }
  
  let totalCached = 0;
  let totalCount = 0;
  
  for (const lesson of lessons) {
    const sentenceCount = lesson.sentence_count || lesson.sentences_count || 0;
    if (sentenceCount > 0) {
      const status = await checkLessonAudioStatus(courseId, lesson.id, sentenceCount);
      totalCached += status.cached;
      totalCount += status.total;
    }
  }
  
  return { cached: totalCached, total: totalCount };
}
