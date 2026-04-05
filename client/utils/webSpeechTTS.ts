/**
 * Web Speech Synthesis API 语音合成工具
 * 用于 Safari/Chrome 等浏览器的原生 TTS
 * 
 * 优点：
 * - 完全免费，不需要 API Key
 * - 支持多种语言（法语、德语、西班牙语等）
 * - 浏览器原生支持，无需网络请求
 * 
 * 注意：
 * - Safari/Chrome 需要用户交互后才能播放
 * - 不同浏览器支持的声音可能不同
 */

// 语言代码映射
const LANGUAGE_VOICE_MAP: Record<string, string[]> = {
  'fr': ['fr-FR', 'fr-CA', 'fr-CH', 'fr-BE'],  // 法语
  'de': ['de-DE', 'de-AT', 'de-CH'],           // 德语
  'es': ['es-ES', 'es-MX', 'es-AR'],           // 西班牙语
  'ja': ['ja-JP'],                              // 日语
  'ko': ['ko-KR'],                              // 韩语
  'zh': ['zh-CN', 'zh-TW', 'zh-HK'],           // 中文
  'en': ['en-US', 'en-GB', 'en-AU'],           // 英语
};

// 检测浏览器是否支持 Web Speech Synthesis
export function isWebSpeechTTSSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

// 获取可用的声音列表
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isWebSpeechTTSSupported()) return [];
  return window.speechSynthesis.getVoices();
}

// 获取指定语言的最佳声音
export function getBestVoiceForLanguage(language: string): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  const langCodes = LANGUAGE_VOICE_MAP[language] || [language];
  
  console.log(`[Web TTS] 查找声音 - 语言: ${language}, 可用声音数量: ${voices.length}`);
  
  // 打印所有可用的法语声音（调试用）
  if (language === 'fr') {
    const frenchVoices = voices.filter(v => v.lang.startsWith('fr'));
    console.log(`[Web TTS] 法语声音列表:`, frenchVoices.map(v => `${v.name} (${v.lang}, local: ${v.localService})`));
  }
  
  // 优先级：原生声音 > 非原生声音
  for (const langCode of langCodes) {
    // 先找原生声音
    const nativeVoice = voices.find(v => 
      v.lang === langCode && v.localService
    );
    if (nativeVoice) {
      console.log(`[Web TTS] 找到原生声音: ${nativeVoice.name} (${nativeVoice.lang})`);
      return nativeVoice;
    }
    
    // 再找任何支持该语言的声音
    const anyVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (anyVoice) {
      console.log(`[Web TTS] 找到声音: ${anyVoice.name} (${anyVoice.lang})`);
      return anyVoice;
    }
  }
  
  console.log(`[Web TTS] 未找到 ${language} 的声音，使用默认声音`);
  return null;
}

export interface WebTTSOptions {
  text: string;
  language?: string;      // 语言代码：'fr', 'de', 'es', 'ja', 'ko', 'zh', 'en'
  rate?: number;          // 语速：0.1 - 10，默认 1
  pitch?: number;         // 音调：0 - 2，默认 1
  volume?: number;        // 音量：0 - 1，默认 1
  voice?: string;         // 指定声音名称
  onStart?: () => void;   // 开始播放回调
  onEnd?: () => void;     // 播放结束回调
  onError?: (error: string) => void;  // 错误回调
}

/**
 * 使用 Web Speech Synthesis 播放文本
 * 返回一个停止函数
 */
export function speakWithWebTTS(options: WebTTSOptions): () => void {
  const {
    text,
    language = 'en',
    rate = 1,
    pitch = 1,
    volume = 1,
    voice,
    onStart,
    onEnd,
    onError,
  } = options;

  if (!isWebSpeechTTSSupported()) {
    onError?.('Web Speech Synthesis 不支持');
    return () => {};
  }

  const utterance = new SpeechSynthesisUtterance(text);
  
  // 设置语言
  const langCodes = LANGUAGE_VOICE_MAP[language] || [language];
  utterance.lang = langCodes[0];
  
  console.log(`[Web TTS] 准备播放 - 语言: ${language}, 文本: "${text.substring(0, 50)}...", 设置语言代码: ${utterance.lang}`);
  
  // 设置声音
  if (voice) {
    const voices = getAvailableVoices();
    const selectedVoice = voices.find(v => v.name === voice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`[Web TTS] 使用指定声音: ${selectedVoice.name}`);
    }
  } else {
    const bestVoice = getBestVoiceForLanguage(language);
    if (bestVoice) {
      utterance.voice = bestVoice;
      console.log(`[Web TTS] 使用最佳声音: ${bestVoice.name} (${bestVoice.lang})`);
    } else {
      console.log(`[Web TTS] 未找到合适声音，使用浏览器默认声音`);
    }
  }
  
  // 设置参数
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  
  // 设置回调
  utterance.onstart = () => {
    console.log(`[Web TTS] 开始播放: ${language}`);
    onStart?.();
  };
  
  utterance.onend = () => {
    console.log('[Web TTS] 播放结束');
    onEnd?.();
  };
  
  utterance.onerror = (event) => {
    console.error('[Web TTS] 播放错误:', event.error);
    onError?.(event.error);
  };
  
  // 取消之前的播放（避免排队）
  window.speechSynthesis.cancel();
  
  // 开始播放
  window.speechSynthesis.speak(utterance);
  
  // 返回停止函数
  return () => {
    window.speechSynthesis.cancel();
    onEnd?.();
  };
}

/**
 * 停止所有 Web Speech TTS 播放
 */
export function stopWebTTS(): void {
  if (!isWebSpeechTTSSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * 暂停 Web Speech TTS 播放
 */
export function pauseWebTTS(): void {
  if (!isWebSpeechTTSSupported()) return;
  window.speechSynthesis.pause();
}

/**
 * 恢复 Web Speech TTS 播放
 */
export function resumeWebTTS(): void {
  if (!isWebSpeechTTSSupported()) return;
  window.speechSynthesis.resume();
}

/**
 * 检查是否正在播放
 */
export function isWebTTSSpeaking(): boolean {
  if (!isWebSpeechTTSSupported()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * 等待声音列表加载完成
 * Chrome 需要异步加载声音列表
 */
export function waitForVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isWebSpeechTTSSupported()) {
      resolve([]);
      return;
    }
    
    const voices = getAvailableVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    
    // Chrome 需要等待 voiceschanged 事件
    const handleVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(getAvailableVoices());
    };
    
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    
    // 超时保护
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(getAvailableVoices());
    }, 1000);
  });
}

/**
 * 检测指定语言是否有可用的原生 TTS 声音
 */
export function hasNativeVoiceForLanguage(language: string): boolean {
  const voice = getBestVoiceForLanguage(language);
  return voice !== null && voice.localService;
}
