/**
 * 课程音频缓存服务
 * 将音频文件缓存到本地，避免重复下载
 * 
 * 注意：Web 端不支持 expo-file-system，使用浏览器 Cache API 替代
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 缓存目录（仅原生端使用）
const CACHE_DIR = '/tmp/lesson_audio_cache/';
const CACHE_INDEX_KEY = 'lesson_audio_cache_index';

// Web 端使用的 Cache API 名称
const WEB_CACHE_NAME = 'lesson_audio_cache_v1';

interface CacheIndex {
  [audioKey: string]: {
    localUri: string;
    timestamp: number;
    size: number;
  };
}

export interface DownloadProgress {
  current: number;
  total: number;
  currentVoice: string;
  voiceProgress: number; // 0-100
}

// 检测是否为 Web 端
const isWeb = Platform.OS === 'web';

// Web 端：使用浏览器 Cache API
async function getWebCache(): Promise<Cache | null> {
  if (!isWeb) return null;
  
  try {
    const cache = await caches.open(WEB_CACHE_NAME);
    return cache;
  } catch (error) {
    console.error('[Web缓存] 打开 Cache API 失败:', error);
    return null;
  }
}

// 原生端：确保缓存目录存在
async function ensureCacheDir(): Promise<void> {
  if (isWeb) return;
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!(dirInfo as any).exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    // 目录可能已存在，忽略错误
  }
}

// 获取缓存索引
async function getCacheIndex(): Promise<CacheIndex> {
  try {
    const indexJson = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return indexJson ? JSON.parse(indexJson) : {};
  } catch {
    return {};
  }
}

// 保存缓存索引
async function saveCacheIndex(index: CacheIndex): Promise<void> {
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

/**
 * 获取缓存音频的本地URI
 * @param audioKey 音频的唯一标识（如：lessons/1/sentence_1_xxx.mp3）
 * @param remoteUrl 远程URL
 * @returns 本地URI或远程URL
 */
export async function getCachedAudio(audioKey: string, remoteUrl: string): Promise<string> {
  // Web 端：检查浏览器缓存
  if (isWeb) {
    try {
      const cache = await getWebCache();
      if (cache) {
        const cachedResponse = await cache.match(remoteUrl);
        if (cachedResponse) {
          console.log(`[Web缓存] 命中缓存: ${audioKey}`);
          return remoteUrl; // Web 端直接返回远程 URL，浏览器会从缓存读取
        }
      }
      
      // 未缓存，预加载到浏览器缓存
      if (cache) {
        console.log(`[Web缓存] 预加载: ${audioKey}`);
        await cache.add(remoteUrl);
      }
      
      return remoteUrl;
    } catch (error) {
      console.error('[Web缓存] 缓存失败:', error);
      return remoteUrl;
    }
  }
  
  // 原生端：使用文件系统缓存
  try {
    await ensureCacheDir();
    const index = await getCacheIndex();
    
    // 检查是否已缓存
    const cached = index[audioKey];
    if (cached) {
      try {
        const localInfo = await FileSystem.getInfoAsync(cached.localUri);
        if ((localInfo as any).exists) {
          console.log(`[音频缓存] 命中缓存: ${audioKey}`);
          return cached.localUri;
        }
      } catch {
        // 文件不存在，继续下载
      }
    }
    
    // 未缓存，下载并缓存
    console.log(`[音频缓存] 下载中: ${audioKey}`);
    const localUri = `${CACHE_DIR}${audioKey.replace(/\//g, '_')}`;
    
    await FileSystem.downloadAsync(remoteUrl, localUri);
    
    const info = await FileSystem.getInfoAsync(localUri);
    
    // 更新索引
    index[audioKey] = {
      localUri,
      timestamp: Date.now(),
      size: (info as any).size || 0,
    };
    await saveCacheIndex(index);
    
    console.log(`[音频缓存] 缓存完成: ${audioKey}`);
    return localUri;
  } catch (error) {
    console.error('[音频缓存] 缓存失败:', error);
    // 缓存失败时返回远程URL
    return remoteUrl;
  }
}

/**
 * 检查某个音色的缓存状态
 */
export async function checkVoiceCacheStatus(
  lessonId: string,
  voiceId: string,
  sentenceCount: number
): Promise<{ cached: number; total: number }> {
  // Web 端：检查浏览器缓存
  if (isWeb) {
    try {
      const index = await getCacheIndex();
      let cached = 0;
      
      // 检查索引中记录的缓存状态
      for (let i = 1; i <= sentenceCount; i++) {
        const key = `lesson_${lessonId}_sentence_${i}_${voiceId}`;
        if (index[key] && index[key].timestamp > 0) {
          cached++;
        }
      }
      
      return { cached, total: sentenceCount };
    } catch {
      return { cached: 0, total: sentenceCount };
    }
  }
  
  // 原生端
  const index = await getCacheIndex();
  let cached = 0;
  
  for (let i = 1; i <= sentenceCount; i++) {
    const key = `lesson_${lessonId}_sentence_${i}_${voiceId}`;
    if (index[key]) {
      try {
        const localInfo = await FileSystem.getInfoAsync(index[key].localUri);
        if ((localInfo as any).exists) {
          cached++;
        }
      } catch {
        // 文件不存在，不计入
      }
    }
  }
  
  return { cached, total: sentenceCount };
}

/**
 * 检查某个音色在浏览器缓存中的实际状态（仅 Web 端）
 */
export async function checkWebCacheActualStatus(
  lessonId: string,
  voiceId: string,
  audios: Array<{ sentence_index: number; audio_url?: string }>
): Promise<{ cached: number; total: number }> {
  if (!isWeb) {
    return { cached: 0, total: audios.length };
  }
  
  try {
    const cache = await getWebCache();
    if (!cache) {
      return { cached: 0, total: audios.length };
    }
    
    let cached = 0;
    const total = audios.filter(a => a.audio_url).length;
    
    for (const audio of audios) {
      if (audio.audio_url) {
        const cachedResponse = await cache.match(audio.audio_url);
        if (cachedResponse) {
          cached++;
        }
      }
    }
    
    return { cached, total };
  } catch {
    return { cached: 0, total: audios.length };
  }
}

/**
 * 批量预缓存音频（带进度回调）
 * @param audios 音频列表 [{key, url}]
 * @param onProgress 进度回调
 */
export async function precacheAudios(
  audios: Array<{ key: string; url: string }>,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  if (audios.length === 0) return;
  
  // Web 端：使用浏览器 Cache API
  if (isWeb) {
    try {
      const cache = await getWebCache();
      if (!cache) {
        console.log('[Web缓存] Cache API 不可用');
        onProgress?.({
          current: audios.length,
          total: audios.length,
          currentVoice: '',
          voiceProgress: 100,
        });
        return;
      }
      
      const index = await getCacheIndex();
      let downloaded = 0;
      const total = audios.length;
      
      console.log(`[Web缓存] 预缓存 ${total} 个音频`);
      
      for (const audio of audios) {
        try {
          // 检查是否已缓存
          const cachedResponse = await cache.match(audio.url);
          if (!cachedResponse) {
            // 使用 fetch + put 替代 add，避免 CORS 问题
            const response = await fetch(audio.url);
            if (response.ok) {
              await cache.put(audio.url, response);
              console.log(`[Web缓存] 已缓存: ${audio.key}`);
            }
          } else {
            console.log(`[Web缓存] 已存在: ${audio.key}`);
          }
          
          // 更新索引
          index[audio.key] = {
            localUri: audio.url,
            timestamp: Date.now(),
            size: 0,
          };
          
          downloaded++;
          onProgress?.({
            current: downloaded,
            total,
            currentVoice: audio.key,
            voiceProgress: Math.round((downloaded / total) * 100),
          });
        } catch (error) {
          console.error(`[Web缓存] 缓存失败: ${audio.key}`, error);
          downloaded++;
          onProgress?.({
            current: downloaded,
            total,
            currentVoice: audio.key,
            voiceProgress: Math.round((downloaded / total) * 100),
          });
        }
      }
      
      await saveCacheIndex(index);
      console.log('[Web缓存] 预缓存完成');
    } catch (error) {
      console.error('[Web缓存] 预缓存失败:', error);
    }
    return;
  }
  
  // 原生端：使用文件系统缓存
  await ensureCacheDir();
  const index = await getCacheIndex();
  
  const toDownload = audios.filter(audio => {
    const cached = index[audio.key];
    if (cached) {
      try {
        // 已缓存且文件存在，跳过
        return false;
      } catch {
        return true;
      }
    }
    return true;
  });
  
  if (toDownload.length === 0) {
    console.log('[音频缓存] 全部已缓存');
    onProgress?.({
      current: audios.length,
      total: audios.length,
      currentVoice: '',
      voiceProgress: 100,
    });
    return;
  }
  
  console.log(`[音频缓存] 预缓存 ${toDownload.length} 个音频`);
  
  let downloaded = audios.length - toDownload.length;
  const total = audios.length;
  
  // 串行下载以便报告进度
  for (const audio of toDownload) {
    try {
      const localUri = `${CACHE_DIR}${audio.key.replace(/\//g, '_')}`;
      await FileSystem.downloadAsync(audio.url, localUri);
      
      const info = await FileSystem.getInfoAsync(localUri);
      
      index[audio.key] = {
        localUri,
        timestamp: Date.now(),
        size: (info as any).size || 0,
      };
      
      downloaded++;
      onProgress?.({
        current: downloaded,
        total,
        currentVoice: audio.key,
        voiceProgress: Math.round((downloaded / total) * 100),
      });
    } catch (error) {
      console.error(`[音频缓存] 下载失败: ${audio.key}`, error);
      downloaded++;
      onProgress?.({
        current: downloaded,
        total,
        currentVoice: audio.key,
        voiceProgress: Math.round((downloaded / total) * 100),
      });
    }
  }
  
  await saveCacheIndex(index);
  console.log('[音频缓存] 预缓存完成');
}

/**
 * 预缓存单个音色的所有句子
 */
export async function precacheVoiceAudios(
  lessonId: string,
  voiceId: string,
  sentences: Array<{ sentence_index: number; audio_url?: string }>,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const audios = sentences
    .filter(s => s.audio_url)
    .map(s => ({
      key: `lesson_${lessonId}_sentence_${s.sentence_index}_${voiceId}`,
      url: s.audio_url!,
    }));
  
  await precacheAudios(audios, onProgress);
}

/**
 * 清理过期缓存（超过7天未使用）
 */
export async function cleanExpiredCache(): Promise<void> {
  // Web 端：清理浏览器缓存
  if (isWeb) {
    try {
      const cache = await getWebCache();
      if (cache) {
        // 浏览器缓存会自动管理，这里只清理索引
        const index = await getCacheIndex();
        const now = Date.now();
        const expireMs = 7 * 24 * 60 * 60 * 1000; // 7天
        
        for (const [key, cached] of Object.entries(index)) {
          if (now - cached.timestamp > expireMs) {
            delete index[key];
            console.log(`[Web缓存] 清理过期索引: ${key}`);
          }
        }
        
        await saveCacheIndex(index);
      }
    } catch (error) {
      console.error('[Web缓存] 清理失败:', error);
    }
    return;
  }
  
  // 原生端
  const index = await getCacheIndex();
  const now = Date.now();
  const expireMs = 7 * 24 * 60 * 60 * 1000; // 7天
  
  for (const [key, cached] of Object.entries(index)) {
    if (now - cached.timestamp > expireMs) {
      try {
        await FileSystem.deleteAsync(cached.localUri);
        delete index[key];
        console.log(`[音频缓存] 清理过期: ${key}`);
      } catch (error) {
        // 忽略删除失败
      }
    }
  }
  
  await saveCacheIndex(index);
}

/**
 * 获取缓存统计
 */
export async function getCacheStats(): Promise<{ count: number; size: number }> {
  const index = await getCacheIndex();
  const entries = Object.values(index);
  
  return {
    count: entries.length,
    size: entries.reduce((sum, e) => sum + e.size, 0),
  };
}
