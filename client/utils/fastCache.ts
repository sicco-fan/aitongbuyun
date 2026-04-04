/**
 * 极速缓存服务
 * 为 VIP 用户提供音频预加载和智能缓存
 * 
 * 特权账户：
 * - 18874255388（管理员）
 * - 手机尾号 3987
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// VIP 用户配置
const VIP_PHONES = ['18874255388', 'suffix_3987'];

// 缓存配置
const CACHE_CONFIG = {
  // Web 端 Cache API 名称
  WEB_CACHE_NAME: 'ai_dictation_fast_cache_v1',
  // 预加载音频数量
  PRELOAD_COUNT: 5,
  // 缓存有效期（24小时）
  CACHE_TTL: 24 * 60 * 60 * 1000,
};

// TTS 音频缓存索引
const TTS_CACHE_INDEX_KEY = 'tts_cache_index';

interface TtsCacheIndex {
  [key: string]: {
    url: string;
    timestamp: number;
    size: number;
  };
}

/**
 * 检查当前用户是否为 VIP
 */
export async function isVipUser(): Promise<boolean> {
  try {
    // 从 AsyncStorage 获取用户信息
    const userJson = await AsyncStorage.getItem('user');
    if (!userJson) return false;
    
    const user = JSON.parse(userJson);
    
    // 检查手机号
    if (user.phone) {
      // 完全匹配管理员账户
      if (user.phone === '18874255388') return true;
      // 匹配手机尾号 3987
      if (user.phone.endsWith('3987')) return true;
    }
    
    // 检查用户ID
    if (user.id === '18874255388') return true;
    
    return false;
  } catch (error) {
    console.error('[VIP检测] 失败:', error);
    return false;
  }
}

/**
 * 获取用户手机号
 */
export async function getUserPhone(): Promise<string | null> {
  try {
    const userJson = await AsyncStorage.getItem('user');
    if (!userJson) return null;
    
    const user = JSON.parse(userJson);
    return user.phone || null;
  } catch {
    return null;
  }
}

/**
 * Web 端：获取 Cache API 实例
 */
async function getWebCache(): Promise<Cache | null> {
  if (Platform.OS !== 'web') return null;
  
  try {
    const cache = await caches.open(CACHE_CONFIG.WEB_CACHE_NAME);
    return cache;
  } catch (error) {
    console.error('[Web缓存] 打开失败:', error);
    return null;
  }
}

/**
 * 预加载 TTS 音频
 * 在用户开始学习前，预先加载接下来的 N 个句子音频
 */
export async function preloadTtsAudios(
  sentences: Array<{ text: string; speaker?: string }>,
  currentIndex: number,
  baseUrl: string,
  language: string = 'en'
): Promise<void> {
  if (Platform.OS !== 'web') return;
  
  try {
    const cache = await getWebCache();
    if (!cache) return;
    
    const isVip = await isVipUser();
    const preloadCount = isVip ? CACHE_CONFIG.PRELOAD_COUNT : 2;
    
    // 预加载接下来的 N 个句子
    const toPreload = sentences.slice(currentIndex + 1, currentIndex + 1 + preloadCount);
    
    for (const sentence of toPreload) {
      const speaker = sentence.speaker || 'zh_female_xiaohe_uranus_bigtts';
      const ttsUrl = `${baseUrl}/api/v1/tts?text=${encodeURIComponent(sentence.text)}&speaker=${speaker}&language=${language}`;
      
      // 检查是否已缓存
      const cached = await cache.match(ttsUrl);
      if (!cached) {
        // 异步预加载，不阻塞
        fetch(ttsUrl).then(async (response) => {
          if (response.ok) {
            await cache.put(ttsUrl, response.clone());
            console.log(`[预加载] 已缓存: "${sentence.text.substring(0, 20)}..."`);
          }
        }).catch((err) => {
          console.error('[预加载] 失败:', err);
        });
      }
    }
  } catch (error) {
    console.error('[预加载] 失败:', error);
  }
}

/**
 * 获取缓存的 TTS 音频 URL
 * 如果已缓存，直接返回可播放的 URL
 */
export async function getCachedTtsUrl(
  text: string,
  speaker: string,
  baseUrl: string,
  language: string = 'en'
): Promise<string> {
  if (Platform.OS !== 'web') {
    return `${baseUrl}/api/v1/tts?text=${encodeURIComponent(text)}&speaker=${speaker}&language=${language}`;
  }
  
  try {
    const cache = await getWebCache();
    if (!cache) {
      return `${baseUrl}/api/v1/tts?text=${encodeURIComponent(text)}&speaker=${speaker}&language=${language}`;
    }
    
    const ttsUrl = `${baseUrl}/api/v1/tts?text=${encodeURIComponent(text)}&speaker=${speaker}&language=${language}`;
    
    // 检查缓存
    const cached = await cache.match(ttsUrl);
    if (cached) {
      console.log(`[TTS缓存] 命中: "${text.substring(0, 20)}..."`);
      // 返回 blob URL 以便直接播放
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
    
    // 未缓存，触发后台缓存
    fetch(ttsUrl).then(async (response) => {
      if (response.ok) {
        await cache.put(ttsUrl, response.clone());
        console.log(`[TTS缓存] 已缓存: "${text.substring(0, 20)}..."`);
      }
    }).catch(() => {});
    
    return ttsUrl;
  } catch (error) {
    console.error('[TTS缓存] 失败:', error);
    return `${baseUrl}/api/v1/tts?text=${encodeURIComponent(text)}&speaker=${speaker}&language=${language}`;
  }
}

/**
 * 预缓存课程音频（用于 VIP 用户）
 * 在进入课程前，批量预加载所有音频
 */
export async function precacheCourseAudios(
  sentences: Array<{ text: string; audio_url?: string }>,
  voiceId: string,
  baseUrl: string
): Promise<{ cached: number; total: number }> {
  if (Platform.OS !== 'web') {
    return { cached: 0, total: sentences.length };
  }
  
  try {
    const cache = await getWebCache();
    if (!cache) {
      return { cached: 0, total: sentences.length };
    }
    
    let cached = 0;
    const total = sentences.length;
    
    for (const sentence of sentences) {
      try {
        // 如果有预设音频 URL，缓存它
        if (sentence.audio_url) {
          const cachedResponse = await cache.match(sentence.audio_url);
          if (!cachedResponse) {
            const response = await fetch(sentence.audio_url);
            if (response.ok) {
              await cache.put(sentence.audio_url, response);
            }
          }
        }
        
        // 同时缓存 TTS 版本
        const ttsUrl = `${baseUrl}/api/v1/tts?text=${encodeURIComponent(sentence.text)}&speaker=${voiceId}`;
        const cachedTts = await cache.match(ttsUrl);
        if (!cachedTts) {
          fetch(ttsUrl).then(async (response) => {
            if (response.ok) {
              await cache.put(ttsUrl, response);
            }
          }).catch(() => {});
        }
        
        cached++;
      } catch (err) {
        console.error('[课程预缓存] 单个失败:', err);
      }
    }
    
    console.log(`[课程预缓存] 完成: ${cached}/${total}`);
    return { cached, total };
  } catch (error) {
    console.error('[课程预缓存] 失败:', error);
    return { cached: 0, total: sentences.length };
  }
}

/**
 * 清理过期缓存
 */
export async function cleanExpiredCache(): Promise<void> {
  if (Platform.OS !== 'web') return;
  
  try {
    const cache = await getWebCache();
    if (!cache) return;
    
    // 获取所有缓存键
    const keys = await cache.keys();
    const now = Date.now();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const cacheTime = new Date(dateHeader).getTime();
          if (now - cacheTime > CACHE_CONFIG.CACHE_TTL) {
            await cache.delete(request);
            console.log('[缓存清理] 删除过期:', request.url);
          }
        }
      }
    }
  } catch (error) {
    console.error('[缓存清理] 失败:', error);
  }
}

/**
 * 获取缓存统计
 */
export async function getCacheStats(): Promise<{ count: number; estimatedSize: string }> {
  if (Platform.OS !== 'web') {
    return { count: 0, estimatedSize: '0 MB' };
  }
  
  try {
    const cache = await getWebCache();
    if (!cache) {
      return { count: 0, estimatedSize: '0 MB' };
    }
    
    const keys = await cache.keys();
    let totalSize = 0;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
    
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    return { count: keys.length, estimatedSize: `${sizeMB} MB` };
  } catch (error) {
    console.error('[缓存统计] 失败:', error);
    return { count: 0, estimatedSize: '0 MB' };
  }
}

/**
 * 初始化极速缓存
 * 检查 VIP 状态并预加载常用资源
 */
export async function initFastCache(): Promise<boolean> {
  try {
    const isVip = await isVipUser();
    
    if (isVip) {
      console.log('[极速缓存] VIP 用户，启用极速模式');
      
      // 清理过期缓存
      await cleanExpiredCache();
      
      // 获取缓存统计
      const stats = await getCacheStats();
      console.log('[极速缓存] 当前缓存:', stats);
      
      return true;
    }
    
    console.log('[极速缓存] 普通用户');
    return false;
  } catch (error) {
    console.error('[极速缓存] 初始化失败:', error);
    return false;
  }
}
