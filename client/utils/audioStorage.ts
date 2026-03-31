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
  console.log(`[本地存储] 检查音频目录: ${AUDIO_DIR}`);
  
  try {
    const dirInfo = await FS.getInfoAsync(AUDIO_DIR);
    if (!dirInfo.exists) {
      console.log(`[本地存储] 创建音频目录: ${AUDIO_DIR}`);
      await FS.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
    } else {
      console.log(`[本地存储] 音频目录已存在`);
    }
  } catch (error) {
    console.error(`[本地存储] 检查/创建音频目录失败:`, error);
    throw error;
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
  
  console.log(`[本地存储] 开始保存音频, key: ${key}, 数据大小: ${base64Data.length} 字符`);
  
  await ensureAudioDir();
  
  const AUDIO_DIR = getAudioDir();
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  try {
    await FS.writeAsStringAsync(filePath, base64Data, {
      encoding: 'base64',
    });
    
    // 验证保存是否成功
    const fileInfo = await FS.getInfoAsync(filePath);
    if (fileInfo.exists) {
      const size = 'size' in fileInfo ? fileInfo.size : '未知';
      console.log(`[本地存储] 音频保存成功: ${filePath}, 文件大小: ${size}`);
    } else {
      console.error(`[本地存储] 音频保存失败: 文件不存在`);
    }
    
    return filePath;
  } catch (error) {
    console.error(`[本地存储] 保存音频失败: ${filePath}`, error);
    throw error;
  }
}

/**
 * 从本地读取音频
 * @param key 音频唯一标识
 * @returns 本地文件URI，如果不存在返回null
 */
export async function getAudioFromLocal(key: string): Promise<string | null> {
  if (!isLocalStorageSupported()) {
    console.log(`[本地存储] Web端不支持本地存储，key: ${key}`);
    return null;
  }
  
  const AUDIO_DIR = getAudioDir();
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  try {
    const fileInfo = await FS.getInfoAsync(filePath);
    if (fileInfo.exists) {
      console.log(`[本地存储] 找到音频: ${filePath}`);
      return filePath;
    }
    console.log(`[本地存储] 音频不存在: ${filePath}`);
  } catch (e) {
    console.log(`[本地存储] 检查音频失败: ${filePath}`, e);
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
    const exists = fileInfo.exists;
    console.log(`[本地存储] 检查文件: ${filePath}, 存在: ${exists}`);
    return exists;
  } catch (e) {
    console.log(`[本地存储] 检查文件失败: ${filePath}`, e);
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

// 四种AI音色
const AI_VOICE_IDS = [
  'zh_female_vv_uranus_bigtts',    // 薇薇（双语女声）
  'zh_female_xiaohe_uranus_bigtts', // 晓荷（中文女声）
  'zh_male_m191_uranus_bigtts',     // 云舟（中文男声）
  'zh_male_taocheng_uranus_bigtts', // 晓天（中文男声）
];

/**
 * 检查课时每个音色的音频缓存状态
 * @param courseId 课程ID
 * @param lessonId 课时ID
 * @param sentenceCount 句子数量
 * @returns 每个音色的缓存状态和总体状态
 */
export async function checkLessonAudioStatusByVoice(
  courseId: number,
  lessonId: number,
  sentenceCount: number
): Promise<{ 
  voiceStatus: Array<{ voiceId: string; voiceName: string; cached: number; total: number }>;
  completedVoices: number; // 完全下载完成的音色数量
  totalVoices: number;     // 总音色数量
  isComplete: boolean;     // 是否全部音色都已下载完成
}> {
  console.log(`[checkLessonAudioStatusByVoice] 开始检查 courseId=${courseId}, lessonId=${lessonId}, sentenceCount=${sentenceCount}`);
  
  if (!isLocalStorageSupported()) {
    console.log(`[checkLessonAudioStatusByVoice] 本地存储不支持，返回空状态`);
    return {
      voiceStatus: AI_VOICE_IDS.map(voiceId => ({
        voiceId,
        voiceName: voiceId,
        cached: 0,
        total: sentenceCount,
      })),
      completedVoices: 0,
      totalVoices: AI_VOICE_IDS.length,
      isComplete: false,
    };
  }
  
  const voiceNames: Record<string, string> = {
    'zh_female_vv_uranus_bigtts': '薇薇',
    'zh_female_xiaohe_uranus_bigtts': '晓荷',
    'zh_male_m191_uranus_bigtts': '云舟',
    'zh_male_taocheng_uranus_bigtts': '晓天',
  };
  
  const voiceStatus: Array<{ voiceId: string; voiceName: string; cached: number; total: number }> = [];
  let completedVoices = 0;
  
  for (const voiceId of AI_VOICE_IDS) {
    let cached = 0;
    for (let i = 1; i <= sentenceCount; i++) {
      const key = `course_${courseId}_lesson_${lessonId}_sentence_${i}_${voiceId}`;
      if (await hasAudioLocal(key)) {
        cached++;
      }
    }
    
    console.log(`[checkLessonAudioStatusByVoice] 音色 ${voiceId}: ${cached}/${sentenceCount} 缓存`);
    
    voiceStatus.push({
      voiceId,
      voiceName: voiceNames[voiceId] || voiceId,
      cached,
      total: sentenceCount,
    });
    
    if (cached === sentenceCount) {
      completedVoices++;
    }
  }
  
  const result = {
    voiceStatus,
    completedVoices,
    totalVoices: AI_VOICE_IDS.length,
    isComplete: completedVoices === AI_VOICE_IDS.length,
  };
  
  console.log(`[checkLessonAudioStatusByVoice] 结果: ${completedVoices}/${AI_VOICE_IDS.length} 音色完成`);
  return result;
}

/**
 * 获取课时缺失音色的列表
 * @param courseId 课程ID
 * @param lessonId 课时ID
 * @param sentenceCount 句子数量
 * @returns 缺失的音色ID列表
 */
export async function getMissingVoicesForLesson(
  courseId: number,
  lessonId: number,
  sentenceCount: number
): Promise<string[]> {
  const missingVoices: string[] = [];
  
  for (const voiceId of AI_VOICE_IDS) {
    let cached = 0;
    for (let i = 1; i <= sentenceCount; i++) {
      const key = `course_${courseId}_lesson_${lessonId}_sentence_${i}_${voiceId}`;
      if (await hasAudioLocal(key)) {
        cached++;
      }
    }
    // 如果该音色没有完全下载，加入缺失列表
    if (cached < sentenceCount) {
      missingVoices.push(voiceId);
    }
  }
  
  return missingVoices;
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
