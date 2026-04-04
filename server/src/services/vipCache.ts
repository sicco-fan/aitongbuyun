/**
 * VIP 用户极速缓存服务
 * 为特权账户提供更大的缓存空间和预加载能力
 */

// VIP 用户配置
const VIP_USERS = {
  // 管理员账户
  '18874255388': { tier: 'admin', cacheLimit: 3 * 1024 * 1024 * 1024 }, // 3GB
  // 手机尾号 3987 的账户（需要匹配手机号后4位）
  'suffix_3987': { tier: 'vip', cacheLimit: 3 * 1024 * 1024 * 1024 }, // 3GB
};

// TTS 音频缓存（扩大到支持更多内容）
const ttsCache = new Map<string, { 
  data: Buffer; 
  timestamp: number;
  size: number;
}>();

// 句子数据缓存
const sentenceCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

// 缓存配置
const CACHE_CONFIG = {
  // VIP 用户缓存有效期：24小时
  VIP_TTL: 24 * 60 * 60 * 1000,
  // 普通用户缓存有效期：1小时
  NORMAL_TTL: 60 * 60 * 1000,
  // VIP 最大缓存条目数
  VIP_MAX_ENTRIES: 10000,
  // 普通用户最大缓存条目数
  NORMAL_MAX_ENTRIES: 500,
};

/**
 * 检查用户是否为 VIP
 */
export function isVipUser(userId: string, phone?: string): boolean {
  // 直接匹配管理员账户
  if (VIP_USERS[userId as keyof typeof VIP_USERS]) {
    return true;
  }
  
  // 匹配手机号后4位
  if (phone && phone.endsWith('3987')) {
    return true;
  }
  
  return false;
}

/**
 * 获取用户的缓存配置
 */
export function getUserCacheConfig(userId: string, phone?: string) {
  if (isVipUser(userId, phone)) {
    return {
      ttl: CACHE_CONFIG.VIP_TTL,
      maxEntries: CACHE_CONFIG.VIP_MAX_ENTRIES,
      isVip: true,
    };
  }
  return {
    ttl: CACHE_CONFIG.NORMAL_TTL,
    maxEntries: CACHE_CONFIG.NORMAL_MAX_ENTRIES,
    isVip: false,
  };
}

/**
 * 获取 TTS 缓存
 */
export function getTtsCache(text: string, speaker: string): Buffer | null {
  const key = `${text}:${speaker}`;
  const cached = ttsCache.get(key);
  
  if (cached) {
    // 检查是否过期
    if (Date.now() - cached.timestamp < CACHE_CONFIG.VIP_TTL) {
      return cached.data;
    }
    // 过期则删除
    ttsCache.delete(key);
  }
  
  return null;
}

/**
 * 设置 TTS 缓存
 */
export function setTtsCache(text: string, speaker: string, data: Buffer): void {
  const key = `${text}:${speaker}`;
  
  // 清理旧缓存
  if (ttsCache.size >= CACHE_CONFIG.VIP_MAX_ENTRIES) {
    cleanupCache();
  }
  
  ttsCache.set(key, {
    data,
    timestamp: Date.now(),
    size: data.length,
  });
}

/**
 * 获取句子数据缓存
 */
export function getSentenceCache(key: string): any | null {
  const cached = sentenceCache.get(key);
  
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_CONFIG.VIP_TTL) {
      return cached.data;
    }
    sentenceCache.delete(key);
  }
  
  return null;
}

/**
 * 设置句子数据缓存
 */
export function setSentenceCache(key: string, data: any): void {
  sentenceCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 清理过期缓存
 */
function cleanupCache(): void {
  const now = Date.now();
  
  // 清理 TTS 缓存
  for (const [key, value] of ttsCache.entries()) {
    if (now - value.timestamp > CACHE_CONFIG.VIP_TTL) {
      ttsCache.delete(key);
    }
  }
  
  // 清理句子缓存
  for (const [key, value] of sentenceCache.entries()) {
    if (now - value.timestamp > CACHE_CONFIG.VIP_TTL) {
      sentenceCache.delete(key);
    }
  }
  
  console.log(`[VIP缓存] 清理完成，TTS: ${ttsCache.size}条, 句子: ${sentenceCache.size}条`);
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  let ttsSize = 0;
  for (const [, value] of ttsCache.entries()) {
    ttsSize += value.size;
  }
  
  return {
    ttsCount: ttsCache.size,
    ttsSize,
    sentenceCount: sentenceCache.size,
  };
}

// 定期清理（每10分钟）
setInterval(() => {
  cleanupCache();
}, 10 * 60 * 1000);
