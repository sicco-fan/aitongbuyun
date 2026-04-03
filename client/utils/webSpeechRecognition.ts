/**
 * Web Speech API 语音识别工具
 * 用于 Safari/Chrome 等浏览器的原生语音识别
 * 
 * 优点：
 * - 不需要上传音频到服务器
 * - 实时识别，响应更快
 * - 浏览器原生支持
 * 
 * 注意：
 * - Safari 需要用户授权麦克风
 * - 部分浏览器可能不支持
 */

// 检测浏览器是否支持 Web Speech API
export function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

// 获取 SpeechRecognition 构造函数
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SpeechRecognition;
}

export interface WebSpeechResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface WebSpeechOptions {
  language?: string; // 'en-US', 'zh-CN' 等
  continuous?: boolean; // 是否持续识别
  interimResults?: boolean; // 是否返回中间结果
  maxAlternatives?: number; // 最多返回几个候选结果
  onInterim?: (text: string) => void; // 中间结果回调
  onError?: (error: string) => void; // 错误回调
}

/**
 * 创建 Web Speech API 识别器
 */
export function createWebSpeechRecognizer(options: WebSpeechOptions = {}) {
  const SpeechRecognition = getSpeechRecognition();
  
  if (!SpeechRecognition) {
    return null;
  }
  
  const recognition = new SpeechRecognition();
  
  // 配置
  recognition.lang = options.language || 'en-US';
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = options.maxAlternatives || 1;
  
  return recognition;
}

/**
 * 开始语音识别（Promise 封装）
 */
export function startWebSpeechRecognition(options: WebSpeechOptions = {}): Promise<WebSpeechResult> {
  return new Promise((resolve, reject) => {
    const recognition = createWebSpeechRecognizer(options);
    
    if (!recognition) {
      reject(new Error('Web Speech API 不支持'));
      return;
    }
    
    let finalResult: WebSpeechResult | null = null;
    
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      
      if (result.isFinal) {
        finalResult = {
          text: transcript,
          confidence,
          isFinal: true,
        };
      } else {
        // 中间结果
        if (options.onInterim) {
          options.onInterim(transcript);
        }
      }
    };
    
    recognition.onend = () => {
      if (finalResult) {
        resolve(finalResult);
      } else {
        // 没有识别到结果
        resolve({
          text: '',
          confidence: 0,
          isFinal: true,
        });
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('[Web Speech] 错误:', event.error);
      
      // 如果是 no-speech 错误，返回空结果而不是错误
      if (event.error === 'no-speech') {
        resolve({
          text: '',
          confidence: 0,
          isFinal: true,
        });
      } else if (options.onError) {
        options.onError(event.error);
      }
      
      reject(new Error(event.error));
    };
    
    try {
      recognition.start();
    } catch (e: any) {
      reject(new Error(e.message || '启动失败'));
    }
  });
}

/**
 * Web Speech API 识别器类（支持手动停止）
 */
export class WebSpeechRecognizer {
  private recognition: any = null;
  private isRunning = false;
  private options: WebSpeechOptions;
  
  constructor(options: WebSpeechOptions = {}) {
    this.options = options;
    this.init();
  }
  
  private init() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    
    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.options.language || 'en-US';
    this.recognition.continuous = this.options.continuous ?? false;
    this.recognition.interimResults = this.options.interimResults ?? true;
    this.recognition.maxAlternatives = this.options.maxAlternatives || 1;
  }
  
  /**
   * 开始识别
   */
  start(): Promise<WebSpeechResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Web Speech API 不支持'));
        return;
      }
      
      if (this.isRunning) {
        reject(new Error('识别已在进行中'));
        return;
      }
      
      let finalResult: WebSpeechResult | null = null;
      
      this.recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        
        if (result.isFinal) {
          finalResult = {
            text: transcript,
            confidence,
            isFinal: true,
          };
        } else {
          if (this.options.onInterim) {
            this.options.onInterim(transcript);
          }
        }
      };
      
      this.recognition.onend = () => {
        this.isRunning = false;
        if (finalResult) {
          resolve(finalResult);
        } else {
          resolve({
            text: '',
            confidence: 0,
            isFinal: true,
          });
        }
      };
      
      this.recognition.onerror = (event: any) => {
        this.isRunning = false;
        console.error('[Web Speech] 错误:', event.error);
        
        if (event.error === 'no-speech') {
          resolve({
            text: '',
            confidence: 0,
            isFinal: true,
          });
        } else if (this.options.onError) {
          this.options.onError(event.error);
        }
        
        reject(new Error(event.error));
      };
      
      try {
        this.isRunning = true;
        this.recognition.start();
      } catch (e: any) {
        this.isRunning = false;
        reject(new Error(e.message || '启动失败'));
      }
    });
  }
  
  /**
   * 停止识别
   */
  stop() {
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('[Web Speech] 停止失败:', e);
      }
      this.isRunning = false;
    }
  }
  
  /**
   * 是否正在运行
   */
  getIsRunning() {
    return this.isRunning;
  }
  
  /**
   * 是否支持
   */
  static isSupported() {
    return isWebSpeechSupported();
  }
}
