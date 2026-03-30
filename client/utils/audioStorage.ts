/**
 * 本地音频存储工具
 * 用于将生成的音频保存到用户设备本地，不占用云端空间
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// 使用 as any 绕过 legacy 版本的类型限制
const FS = FileSystem as any;
const AUDIO_DIR = `${FS.documentDirectory || ''}audio_cache/`;

/**
 * 确保音频目录存在
 */
async function ensureAudioDir(): Promise<void> {
  if (!FS.documentDirectory) return;
  
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
  await ensureAudioDir();
  
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
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  if (fileInfo.exists) {
    return filePath;
  }
  
  return null;
}

/**
 * 检查音频是否已存在于本地
 * @param key 音频唯一标识
 */
export async function hasAudioLocal(key: string): Promise<boolean> {
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  return fileInfo.exists;
}

/**
 * 删除本地音频
 * @param key 音频唯一标识
 */
export async function deleteAudioFromLocal(key: string): Promise<void> {
  const fileName = `${key}.mp3`;
  const filePath = `${AUDIO_DIR}${fileName}`;
  
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(filePath);
  }
}

/**
 * 获取本地音频缓存大小
 */
export async function getAudioCacheSize(): Promise<number> {
  await ensureAudioDir();
  
  const files = await FileSystem.readDirectoryAsync(AUDIO_DIR);
  let totalSize = 0;
  
  for (const file of files) {
    const filePath = `${AUDIO_DIR}${file}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists && 'size' in fileInfo) {
      totalSize += fileInfo.size || 0;
    }
  }
  
  return totalSize;
}

/**
 * 清除所有本地音频缓存
 */
export async function clearAudioCache(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (dirInfo.exists) {
    await FileSystem.deleteAsync(AUDIO_DIR);
  }
}

/**
 * 生成课程句子的音频存储key
 */
export function generateCourseAudioKey(courseId: number, lessonId: number, sentenceIndex: number): string {
  return `course_${courseId}_lesson_${lessonId}_sentence_${sentenceIndex}`;
}

/**
 * 生成句库句子的音频存储key
 */
export function generateFileAudioKey(fileId: number, sentenceIndex: number): string {
  return `file_${fileId}_sentence_${sentenceIndex}`;
}
