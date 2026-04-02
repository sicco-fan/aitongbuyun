/**
 * 日志工具
 * 生产环境自动静默调试日志，保留错误和警告日志
 */

const isProduction = !__DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  error: (...args: any[]) => {
    console.error(...args);
  },
  
  // 用于关键业务日志，生产环境也会打印
  critical: (...args: any[]) => {
    console.log('[CRITICAL]', ...args);
  }
};

export default logger;
