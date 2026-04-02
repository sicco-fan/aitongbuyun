import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
  FadeInDown, 
  FadeIn, 
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome6 } from '@expo/vector-icons';
import { createStyles } from './styles';
import { Spacing, BorderRadius } from '@/constants/theme';
import { createFormDataFile } from '@/utils';
import { saveLastLearningPosition, LastLearningPosition } from '@/utils/learningStorage';
import {
  getVoicePracticeMode,
  VoicePracticeMode,
} from '@/utils/voicePracticeConfig';
import { 
  getAudioFromLocal, 
  generateCourseAudioKey,
  hasAudioLocal,
  hasAudioLocal as hasCourseAudioLocal,
} from '@/utils/audioStorage';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://127.0.0.1:9091';

// ==================== 本地学习进度缓存 ====================
// 格式：learning_progress_${sourceType}_${id}
// 例如：learning_progress_lesson_123, learning_progress_file_456

interface LocalLearningProgress {
  sentenceIndex: number;
  totalSentences: number;
  updatedAt: number;
  completed: boolean; // 是否已完成整个课程
}

const getProgressKey = (sourceType: string, id: string | number): string => {
  return `learning_progress_${sourceType}_${id}`;
};

const saveLocalProgress = async (
  sourceType: string,
  id: string | number,
  progress: LocalLearningProgress
): Promise<void> => {
  try {
    const key = getProgressKey(sourceType, id);
    await AsyncStorage.setItem(key, JSON.stringify(progress));
    console.log(`[本地进度] 已保存: ${key}`, progress);
  } catch (error) {
    console.error('[本地进度] 保存失败:', error);
  }
};

const getLocalProgress = async (
  sourceType: string,
  id: string | number
): Promise<LocalLearningProgress | null> => {
  try {
    const key = getProgressKey(sourceType, id);
    const data = await AsyncStorage.getItem(key);
    if (data) {
      return JSON.parse(data) as LocalLearningProgress;
    }
    return null;
  } catch (error) {
    console.error('[本地进度] 读取失败:', error);
    return null;
  }
};

const clearLocalProgress = async (
  sourceType: string,
  id: string | number
): Promise<void> => {
  try {
    const key = getProgressKey(sourceType, id);
    await AsyncStorage.removeItem(key);
    console.log(`[本地进度] 已清除: ${key}`);
  } catch (error) {
    console.error('[本地进度] 清除失败:', error);
  }
};

/**
 * 判断字符是否为单引号类字符
 * 包含所有可能的单引号变体
 */
const isSingleQuoteLike = (char: string): boolean => {
  const code = char.charCodeAt(0);
  // 常见单引号类字符的 Unicode 码点
  return (
    code === 0x0027 || // ' Apostrophe
    code === 0x0060 || // ` Grave accent
    code === 0x00B4 || // ´ Acute accent
    code === 0x02B9 || // ʹ Modifier letter prime
    code === 0x02BA || // ʺ Modifier letter double prime
    code === 0x02BB || // ʻ Modifier letter turned comma
    code === 0x02BC || // ʼ Modifier letter apostrophe
    code === 0x02BD || // ʽ Modifier letter reversed comma
    code === 0x2018 || // ' Left single quotation mark
    code === 0x2019 || // ' Right single quotation mark
    code === 0x201A || // ‚ Single low-9 quotation mark
    code === 0x201B || // ‛ Single high-reversed-9 quotation mark
    code === 0x2032 || // ′ Prime
    code === 0x2035 || // ‵ Reversed prime
    code === 0xFF07    // ＇ Fullwidth apostrophe
  );
};

/**
 * 判断字符是否为双引号类字符
 */
const isDoubleQuoteLike = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    code === 0x0022 || // " Quotation mark
    code === 0x201C || // " Left double quotation mark
    code === 0x201D || // " Right double quotation mark
    code === 0x201E || // „ Double low-9 quotation mark
    code === 0x201F || // ‟ Double high-reversed-9 quotation mark
    code === 0x2033 || // ″ Double prime
    code === 0x2036    // ‶ Reversed double prime
  );
};

/**
 * 判断字符是否为破折号类字符
 */
const isDashLike = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    code === 0x002D || // - Hyphen-minus
    code === 0x2010 || // – Hyphen
    code === 0x2011 || // ‑ Non-breaking hyphen
    code === 0x2012 || // ‒ Figure dash
    code === 0x2013 || // – En dash
    code === 0x2014 || // — Em dash
    code === 0x2212    // − Minus sign
  );
};

/**
 * 比较两个单词是否匹配（忽略引号格式差异）
 */
const wordsMatch = (word1: string, word2: string): boolean => {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  if (w1.length !== w2.length) return false;
  
  for (let i = 0; i < w1.length; i++) {
    const c1 = w1[i];
    const c2 = w2[i];
    
    // 完全相同
    if (c1 === c2) continue;
    
    // 都是单引号类字符
    if (isSingleQuoteLike(c1) && isSingleQuoteLike(c2)) continue;
    
    // 都是双引号类字符
    if (isDoubleQuoteLike(c1) && isDoubleQuoteLike(c2)) continue;
    
    // 都是破折号类字符
    if (isDashLike(c1) && isDashLike(c2)) continue;
    
    // 不匹配
    return false;
  }
  
  return true;
};

/**
 * 检查单词是否以指定前缀开头（忽略引号格式差异）
 */
const wordsStartWith = (prefix: string, word: string): boolean => {
  const p = prefix.toLowerCase();
  const w = word.toLowerCase();
  
  if (p.length > w.length) return false;
  
  for (let i = 0; i < p.length; i++) {
    const c1 = p[i];
    const c2 = w[i];
    
    // 完全相同
    if (c1 === c2) continue;
    
    // 都是单引号类字符
    if (isSingleQuoteLike(c1) && isSingleQuoteLike(c2)) continue;
    
    // 都是双引号类字符
    if (isDoubleQuoteLike(c1) && isDoubleQuoteLike(c2)) continue;
    
    // 都是破折号类字符
    if (isDashLike(c1) && isDashLike(c2)) continue;
    
    // 不匹配
    return false;
  }
  
  return true;
};

// ============================================================
// 数字/货币/符号变体生成器
// 用于语音识别时处理多种表达方式
// ============================================================

// 基础数字单词
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINAL_ONES = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
const ORDINAL_TEENS = ['tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const ORDINAL_TENS = ['', '', 'twentieth', 'thirtieth', 'fortieth', 'fiftieth', 'sixtieth', 'seventieth', 'eightieth', 'ninetieth'];

// 货币符号映射
const CURRENCY_SYMBOLS: Record<string, { name: string; plural: string; symbol: string }> = {
  '$': { name: 'dollar', plural: 'dollars', symbol: '$' },
  '£': { name: 'pound', plural: 'pounds', symbol: '£' },
  '€': { name: 'euro', plural: 'euros', symbol: '€' },
  '¥': { name: 'yen', plural: 'yen', symbol: '¥' },  // 日元/人民币
  '₹': { name: 'rupee', plural: 'rupees', symbol: '₹' },  // 印度卢比
  '₽': { name: 'ruble', plural: 'rubles', symbol: '₽' },  // 俄罗斯卢布
  '₩': { name: 'won', plural: 'won', symbol: '₩' },  // 韩元
  '₺': { name: 'lira', plural: 'liras', symbol: '₺' },  // 土耳其里拉
  '₴': { name: 'hryvnia', plural: 'hryvnias', symbol: '₴' },  // 乌克兰格里夫纳
  '₸': { name: 'tenge', plural: 'tenge', symbol: '₸' },  // 哈萨克斯坦坚戈
  '₫': { name: 'dong', plural: 'dong', symbol: '₫' },  // 越南盾
  '฿': { name: 'baht', plural: 'baht', symbol: '฿' },  // 泰铢
  '₱': { name: 'peso', plural: 'pesos', symbol: '₱' },  // 比索
  '₳': { name: 'austral', plural: 'australs', symbol: '₳' },
  '₵': { name: 'cedi', plural: 'cedis', symbol: '₵' },  // 加纳塞地
  '₡': { name: 'colon', plural: 'colons', symbol: '₡' },  // 哥斯达黎加科朗
  '₭': { name: 'kip', plural: 'kips', symbol: '₭' },  // 老挝基普
  '₮': { name: 'tugrik', plural: 'tugriks', symbol: '₮' },  // 蒙古图格里克
  '₥': { name: 'mill', plural: 'mills', symbol: '₥' },  // 千分之一美元
  '¢': { name: 'cent', plural: 'cents', symbol: '¢' },  // 美分
};

// 分数单词映射
const FRACTION_WORDS: Record<string, string> = {
  '1/2': 'half',
  '1/3': 'third',
  '1/4': 'quarter',
  '1/5': 'fifth',
  '1/8': 'eighth',
  '1/10': 'tenth',
  '2/3': 'two thirds',
  '3/4': 'three quarters',
  '2/5': 'two fifths',
  '3/5': 'three fifths',
  '4/5': 'four fifths',
};

/**
 * 将数字转换为英文单词
 * 支持整数和小数
 */
const numberToWords = (num: number | string): string[] => {
  const results: string[] = [];
  
  // 转为数字
  const numStr = typeof num === 'string' ? num : String(num);
  
  // 处理小数
  if (numStr.includes('.')) {
    const [intPart, decPart] = numStr.split('.');
    const intWords = numberToWords(intPart)[0] || '';
    const decWords = decPart.split('').map(d => ONES[parseInt(d)]).filter(w => w).join(' ');
    if (intWords) {
      results.push(`${intWords} point ${decWords}`);
      // 也添加不带 point 的版本（有些识别器会省略）
      results.push(`${intWords} ${decWords}`);
    }
    return results;
  }
  
  const n = parseInt(numStr);
  if (isNaN(n) || n < 0) return [numStr];
  
  // 保留原始数字字符串
  results.push(numStr);
  
  if (n === 0) {
    results.push('zero', 'oh');  // oh 常用于电话号码等
    return results;
  }
  
  // 转换为单词
  const parts: string[] = [];
  
  if (n >= 1000000000) {
    const billions = Math.floor(n / 1000000000);
    parts.push(billions === 1 ? 'one billion' : `${numberToWords(billions)[1]} billion`);
    const remainder = n % 1000000000;
    if (remainder > 0) {
      parts.push(numberToWords(remainder)[1]);
    }
  } else if (n >= 1000000) {
    const millions = Math.floor(n / 1000000);
    parts.push(millions === 1 ? 'one million' : `${numberToWords(millions)[1]} million`);
    const remainder = n % 1000000;
    if (remainder > 0) {
      parts.push(numberToWords(remainder)[1]);
    }
  } else if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    parts.push(thousands === 1 ? 'one thousand' : `${numberToWords(thousands)[1]} thousand`);
    const remainder = n % 1000;
    if (remainder > 0) {
      parts.push(numberToWords(remainder)[1]);
    }
  } else if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    parts.push(`${ONES[hundreds]} hundred`);
    const remainder = n % 100;
    if (remainder > 0) {
      parts.push(numberToWords(remainder)[1]);
    }
  } else if (n >= 20) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) {
      parts.push(TENS[tens]);
    } else {
      parts.push(`${TENS[tens]} ${ONES[ones]}`);
    }
  } else if (n >= 10) {
    parts.push(TEENS[n - 10]);
  } else {
    parts.push(ONES[n]);
  }
  
  const wordForm = parts.join(' ').trim();
  if (wordForm) {
    results.push(wordForm);
    // 添加带连字符的版本（如 forty-five）
    if (wordForm.includes(' ')) {
      results.push(wordForm.replace(/(\w+) (\w+)/g, '$1-$2'));
    }
    // 添加 "a" 开头的版本（如 a hundred）
    if (wordForm.startsWith('one hundred') || wordForm.startsWith('one thousand') || 
        wordForm.startsWith('one million') || wordForm.startsWith('one billion')) {
      results.push(wordForm.replace(/^one /, 'a '));
    }
  }
  
  return results;
};

/**
 * 将英文数字单词转换为阿拉伯数字
 * 这是 numberToWords 的反向函数
 * 例如：thirteen -> 13, twenty-five -> 25
 */
const WORD_TO_NUMBER: Record<string, number> = {
  'zero': 0, 'oh': 0,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'eleven': 11, 'twelve': 12,
  'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16,
  'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'million': 1000000, 'billion': 1000000000,
};

const wordToNumber = (word: string): number | null => {
  const w = word.toLowerCase().trim();
  
  // 直接匹配
  if (WORD_TO_NUMBER[w] !== undefined) {
    return WORD_TO_NUMBER[w];
  }
  
  // 处理连字符形式：twenty-five, forty-two
  if (w.includes('-')) {
    const parts = w.split('-');
    let total = 0;
    for (const part of parts) {
      const num = WORD_TO_NUMBER[part];
      if (num === undefined) return null;
      total += num;
    }
    return total;
  }
  
  // 处理空格分隔形式：twenty five, forty two
  if (w.includes(' ')) {
    const parts = w.split(/\s+/);
    let total = 0;
    let current = 0;
    
    for (const part of parts) {
      const num = WORD_TO_NUMBER[part];
      if (num === undefined) return null;
      
      if (num === 100) {
        current = current * 100;
      } else if (num === 1000 || num === 1000000 || num === 1000000000) {
        current = current * num;
        total += current;
        current = 0;
      } else {
        current += num;
      }
    }
    
    return total + current;
  }
  
  return null;
};

/**
 * 检查一个单词是否是英文数字
 */
const isNumberWord = (word: string): boolean => {
  const w = word.toLowerCase().trim();
  
  // 检查是否在映射表中
  if (WORD_TO_NUMBER[w] !== undefined) return true;
  
  // 检查连字符形式
  if (w.includes('-')) {
    const parts = w.split('-');
    return parts.every(p => WORD_TO_NUMBER[p] !== undefined);
  }
  
  // 检查空格分隔形式
  if (w.includes(' ')) {
    const parts = w.split(/\s+/);
    return parts.every(p => WORD_TO_NUMBER[p] !== undefined);
  }
  
  return false;
};

/**
 * 将序数转换为英文单词
 * 例如：1st -> first, 21st -> twenty-first
 */
const ordinalToWords = (ordinal: string): string[] => {
  const results: string[] = [ordinal.toLowerCase()];
  
  // 提取数字部分
  const match = ordinal.match(/^(\d+)(st|nd|rd|th)$/i);
  if (!match) return results;
  
  const num = parseInt(match[1]);
  const suffix = match[2].toLowerCase();
  
  // 1-19 的序数
  if (num >= 1 && num <= 19) {
    if (num <= 9) {
      results.push(ORDINAL_ONES[num]);
    } else {
      results.push(ORDINAL_TEENS[num - 10]);
    }
    return results;
  }
  
  // 20+ 的序数
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  
  if (ones === 0) {
    results.push(ORDINAL_TENS[tens]);
  } else {
    const tenWord = TENS[tens];
    const oneWord = ORDINAL_ONES[ones];
    results.push(`${tenWord}-${oneWord}`);
    results.push(`${tenWord} ${oneWord}`);
  }
  
  return results;
};

/**
 * 将年份转换为可能的读法
 * 例如：2023 -> "twenty twenty-three" 或 "two thousand twenty-three"
 */
const yearToWords = (year: string): string[] => {
  const results: string[] = [year];
  const y = parseInt(year);
  
  if (isNaN(y) || year.length !== 4) return results;
  
  const firstTwo = Math.floor(y / 100);
  const lastTwo = y % 100;
  
  // 方式1: 分成两部分读 (如 20-23)
  if (firstTwo >= 10 && firstTwo <= 99) {
    const firstPart = numberToWords(firstTwo)[1];
    const lastPart = lastTwo === 0 ? 'hundred' : numberToWords(lastTwo)[1];
    results.push(`${firstPart} ${lastPart}`);
    if (lastTwo > 0 && lastTwo < 20) {
      // 带连字符的版本
      const lastPartHyphen = numberToWords(lastTwo).find(w => w.includes('-')) || lastPart;
      results.push(`${firstPart} ${lastPartHyphen}`);
    }
  }
  
  // 方式2: 作为完整数字读 (如 two thousand twenty-three)
  results.push(numberToWords(y)[1]);
  
  // 方式3: "two thousand and twenty-three" (英式英语)
  if (lastTwo > 0) {
    results.push(`${numberToWords(firstTwo * 100)[1]} and ${numberToWords(lastTwo)[1]}`);
  }
  
  return results;
};

/**
 * 将时间转换为可能的读法
 * 例如：9:30 -> "nine thirty", "half past nine"
 */
const timeToWords = (time: string): string[] => {
  const results: string[] = [time];
  
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return results;
  
  const hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  
  const hourWord = numberToWords(hour)[1];
  
  // 整点
  if (minute === 0) {
    results.push(`${hourWord} o'clock`);
    results.push(`${hourWord}`);
    results.push(`${hour} o'clock`);
    return results;
  }
  
  // 常见的分钟读法
  const minuteWord = numberToWords(minute)[1];
  results.push(`${hourWord} ${minuteWord}`);
  results.push(`${hour} ${minuteWord}`);
  
  // 半小时
  if (minute === 30) {
    results.push(`half past ${hourWord}`);
  }
  
  // 一刻钟
  if (minute === 15) {
    results.push(`quarter past ${hourWord}`);
    results.push(`${hourWord} fifteen`);
  }
  
  // 三刻钟
  if (minute === 45) {
    const nextHour = hour === 12 ? 1 : hour + 1;
    const nextHourWord = numberToWords(nextHour)[1];
    results.push(`quarter to ${nextHourWord}`);
    results.push(`${hourWord} forty-five`);
  }
  
  return results;
};

/**
 * 将分数转换为可能的读法
 * 例如：1/2 -> "one half", "a half"
 */
const fractionToWords = (fraction: string): string[] => {
  const results: string[] = [fraction];
  
  // 预定义的常见分数
  if (FRACTION_WORDS[fraction]) {
    results.push(FRACTION_WORDS[fraction]);
  }
  
  const match = fraction.match(/^(\d+)\/(\d+)$/);
  if (!match) return results;
  
  const numerator = parseInt(match[1]);
  const denominator = parseInt(match[2]);
  
  const numWords = numberToWords(numerator)[1];
  
  // 分母转序数
  const getOrdinal = (n: number): string => {
    if (n === 1) return 'whole';
    if (n === 2) return 'half';
    if (n === 3) return 'third';
    if (n === 4) return 'quarter';
    
    // 用序数词规则
    if (n >= 1 && n <= 19) {
      if (n <= 9) return ORDINAL_ONES[n];
      return ORDINAL_TEENS[n - 10];
    }
    
    // 更大的分母
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    if (ones === 0) {
      return ORDINAL_TENS[tens];
    }
    return `${TENS[tens]}-${ORDINAL_ONES[ones]}`;
  };
  
  const denomWord = getOrdinal(denominator);
  
  // 单数形式
  if (numerator === 1) {
    results.push(`one ${denomWord}`);
    results.push(`a ${denomWord}`);
  } else {
    // 复数形式
    const pluralDenom = denomWord.endsWith('s') ? denomWord : `${denomWord}s`;
    results.push(`${numWords} ${pluralDenom}`);
    // 特殊处理 quarter
    if (denomWord === 'quarter') {
      results.push(`${numWords} quarters`);
    }
  }
  
  return results;
};

/**
 * 将货币转换为可能的读法
 * 例如：$100 -> "one hundred dollars", "a hundred bucks"
 */
const currencyToWords = (currency: string): string[] => {
  const results: string[] = [currency];
  
  // 匹配货币符号 + 数字
  const symbolMatch = currency.match(/^([¢$£€¥₹₽₩₺₴₸₫฿₱₳₵₡₭₮₥]+)(\d+\.?\d*)$/);
  if (symbolMatch) {
    const symbol = symbolMatch[1];
    const amount = parseFloat(symbolMatch[2]);
    const currencyInfo = CURRENCY_SYMBOLS[symbol];
    
    if (currencyInfo && !isNaN(amount)) {
      const amountWords = numberToWords(amount);
      
      for (const word of amountWords) {
        // 数字形式
        if (/^\d/.test(word)) {
          results.push(`${word} ${currencyInfo.plural}`);
        } else {
          // 单词形式
          results.push(`${word} ${currencyInfo.plural}`);
          // "a" 开头的版本
          if (word.startsWith('a ') || word.startsWith('one ')) {
            results.push(`${word.replace(/^(a|one) /, '')} ${currencyInfo.name}`);
          }
        }
      }
      
      // 特殊：美元口语 "bucks"
      if (symbol === '$') {
        for (const word of amountWords) {
          if (!/^\d/.test(word) && !word.includes('dollar')) {
            results.push(`${word} bucks`);
          }
        }
      }
      
      // 特殊：英镑口语 "quid"
      if (symbol === '£') {
        for (const word of amountWords) {
          if (!/^\d/.test(word) && !word.includes('pound')) {
            results.push(`${word} quid`);
          }
        }
      }
    }
  }
  
  // 匹配数字 + 货币名称（如 "100 dollars"）
  const nameMatch = currency.match(/^(\d+\.?\d*)\s*(dollars?|pounds?|euros?|yen|won|rupees?|rubles?|cents?|bucks|quid)$/i);
  if (nameMatch) {
    const amount = parseFloat(nameMatch[1]);
    const currencyName = nameMatch[2].toLowerCase();
    
    if (!isNaN(amount)) {
      const amountWords = numberToWords(amount);
      for (const word of amountWords) {
        results.push(`${word} ${currencyName}`);
      }
    }
  }
  
  return results;
};

/**
 * 将百分比转换为可能的读法
 * 例如：50% -> "fifty percent"
 */
const percentToWords = (percent: string): string[] => {
  const results: string[] = [percent];
  
  const match = percent.match(/^(\d+\.?\d*)%$/);
  if (!match) return results;
  
  const num = parseFloat(match[1]);
  if (isNaN(num)) return results;
  
  const numWords = numberToWords(num);
  for (const word of numWords) {
    results.push(`${word} percent`);
  }
  
  return results;
};

/**
 * 特殊符号转换
 */
const symbolToWords = (symbol: string): string[] => {
  const symbolMap: Record<string, string[]> = {
    '&': ['and', 'ampersand'],
    '+': ['plus', 'and', 'with'],
    '@': ['at'],
    '#': ['number', 'hash', 'pound'],
    '*': ['star', 'asterisk'],
    '/': ['slash', 'per', 'over'],
    '\\': ['backslash'],
    '=': ['equals', 'equal to'],
    '<': ['less than'],
    '>': ['greater than'],
    '~': ['approximately', 'about', 'tilde'],
    '≈': ['approximately', 'about'],
    '≠': ['not equal to'],
    '≤': ['less than or equal to'],
    '≥': ['greater than or equal to'],
    '×': ['times', 'multiplied by'],
    '÷': ['divided by', 'over'],
    '±': ['plus or minus'],
    '°': ['degrees', 'degree'],
    '°C': ['degrees celsius', 'celsius'],
    '°F': ['degrees fahrenheit', 'fahrenheit'],
    '℃': ['degrees celsius', 'celsius'],
    '℉': ['degrees fahrenheit', 'fahrenheit'],
    'km/h': ['kilometers per hour', 'kilometers an hour', 'km per hour'],
    'mph': ['miles per hour', 'miles an hour'],
    'kg': ['kilograms', 'kilogram', 'kilo', 'kilos'],
    'g': ['grams', 'gram'],
    'mg': ['milligrams', 'milligram'],
    'lb': ['pounds', 'pound'],
    'oz': ['ounces', 'ounce'],
    'ft': ['feet', 'foot'],
    'in': ['inches', 'inch'],
    'm': ['meters', 'meter'],
    'cm': ['centimeters', 'centimeter'],
    'mm': ['millimeters', 'millimeter'],
    'km': ['kilometers', 'kilometer'],
    'mL': ['milliliters', 'milliliter', 'ml'],
    'L': ['liters', 'liter'],
    'kWh': ['kilowatt hours', 'kilowatt hour'],
    'W': ['watts', 'watt'],
    'kW': ['kilowatts', 'kilowatt'],
    'V': ['volts', 'volt'],
    'A': ['amperes', 'ampere', 'amps', 'amp'],
  };
  
  const lower = symbol.toLowerCase();
  if (symbolMap[symbol] || symbolMap[lower]) {
    return [symbol, ...(symbolMap[symbol] || symbolMap[lower] || [])];
  }
  
  return [symbol];
};

/**
 * 为目标词生成所有可能的语音识别变体
 * 这是最核心的函数，整合所有变体生成逻辑
 */
const generateVariants = (word: string): string[] => {
  const results: string[] = [word.toLowerCase()];
  const w = word.trim();
  
  // 1. 货币符号开头（$100, £50 等）
  if (/^[¢$£€¥₹₽₩₺₴₸₫฿₱₳₵₡₭₮₥]/.test(w)) {
    results.push(...currencyToWords(w));
    // 也处理不带符号的数字部分
    const numPart = w.replace(/^[¢$£€¥₹₽₩₺₴₸₫฿₱₳₵₡₭₮₥]+/, '');
    if (numPart && /^\d/.test(numPart)) {
      results.push(...numberToWords(numPart));
    }
  }
  
  // 2. 百分比（50%）
  if (/^\d+\.?\d*%$/.test(w)) {
    results.push(...percentToWords(w));
  }
  
  // 3. 序数词（1st, 2nd, 21st）
  if (/^\d+(st|nd|rd|th)$/i.test(w)) {
    results.push(...ordinalToWords(w));
    // 也生成数字部分的变体
    const numPart = w.replace(/(st|nd|rd|th)$/i, '');
    results.push(...numberToWords(numPart));
  }
  
  // 4. 分数（1/2, 3/4）
  if (/^\d+\/\d+$/.test(w)) {
    results.push(...fractionToWords(w));
  }
  
  // 5. 时间（9:30）
  if (/^\d{1,2}:\d{2}$/.test(w)) {
    results.push(...timeToWords(w));
  }
  
  // 6. 年份（1900-2099）
  if (/^(19|20)\d{2}$/.test(w)) {
    results.push(...yearToWords(w));
  }
  
  // 7. 纯数字（整数或小数）
  if (/^\d+\.?\d*$/.test(w) && !results.some(r => r !== w.toLowerCase())) {
    results.push(...numberToWords(w));
  }
  
  // 8. 特殊符号和单位
  if (/^[&+@#*/\\=<>~≈≠≤≥×÷±°℃℉]+$/.test(w) || 
      /^(km\/h|mph|kg|g|mg|lb|oz|ft|in|m|cm|mm|mL|L|kWh|W|kW|V|A)$/i.test(w) ||
      /^°[CF]$/.test(w)) {
    results.push(...symbolToWords(w));
  }
  
  // 9. 数字+单位组合（如 5kg, 10km）
  const unitMatch = w.match(/^(\d+\.?\d*)(kg|g|mg|lb|oz|ft|in|m|cm|mm|km|mL|L|kWh|W|kW|V|A)$/i);
  if (unitMatch) {
    const num = unitMatch[1];
    const unit = unitMatch[2];
    const numWords = numberToWords(num);
    const unitWords = symbolToWords(unit);
    for (const nw of numWords) {
      for (const uw of unitWords) {
        results.push(`${nw} ${uw}`);
      }
    }
  }
  
  // 10. 货币名称形式（100 dollars）
  if (/^\d+\.?\d*\s*(dollars?|pounds?|euros?|yen|won|rupees?|rubles?|cents?|bucks|quid)$/i.test(w)) {
    results.push(...currencyToWords(w));
  }
  
  // 11. 连字符单词（cat-like, well-known 等）
  // 语音识别可能把连字符读成空格，所以生成拆分版本
  if (/[-–—]/.test(w) && !w.startsWith('-') && !w.endsWith('-')) {
    const parts = splitHyphenatedWord(w);
    if (parts.length > 1) {
      // 添加空格分开的版本
      results.push(parts.join(' '));
      // 也添加每个部分的单独单词（语音可能只识别一个词）
      parts.forEach(part => {
        if (part.length > 1) {
          results.push(part);
        }
      });
    }
  }
  
  // 12. 缩写词/缩约词（contractions）
  // 语音识别经常把缩写词拆开：it's → it is / it s / its
  const contractionVariants = expandContraction(w);
  results.push(...contractionVariants);
  
  // 13. 英文数字单词 -> 阿拉伯数字变体
  // 例如：thirteen -> 13, twenty-five -> 25
  if (isNumberWord(w)) {
    const num = wordToNumber(w);
    if (num !== null) {
      results.push(String(num));
    }
  }
  
  // 14. o'clock 特殊处理
  // 目标是 "o'clock"，用户可能说 "1:00" 或 "one o'clock"
  if (w.toLowerCase() === "o'clock") {
    // o'clock 单独出现时，可以匹配空（用户可能只说数字）
    results.push('');
  }
  
  // 15. 数字 + o'clock 组合（如 "one o'clock"）
  // 用户可能说 "1:00"，目标是 "one o'clock"
  const oclockMatch = w.match(/^(.+)\s+o'clock$/i);
  if (oclockMatch) {
    const numPart = oclockMatch[1];
    // 生成时间格式变体
    const num = wordToNumber(numPart);
    if (num !== null) {
      results.push(`${num}:00`);  // 1:00
      results.push(String(num));  // 1
    }
    // 也生成数字部分的变体
    results.push(...numberToWords(numPart));
  }
  
  // 16. alright 变体（目标可能是 "all right" 或 "alright"）
  if (w.toLowerCase() === 'alright') {
    results.push('all right', 'all-right');
  }
  if (w.toLowerCase() === 'all right') {
    results.push('alright', 'all-right');
  }
  
  // 17. 常见缩写词变体（B.C., A.D., U.S., U.K., U.S.S.R. 等）
  // 语音识别经常把这些拆开：B.C. -> b c, A.D. -> a d
  const abbrVariants = expandAbbreviation(w);
  results.push(...abbrVariants);
  
  // 18. 连字符单词的部分匹配
  // 目标是 "modern-looking"，用户可能只说 "modern" 或 "looking"
  if (/[-–—]/.test(w) && !w.startsWith('-') && !w.endsWith('-')) {
    const parts = splitHyphenatedWord(w);
    if (parts.length > 1) {
      // 添加每个部分作为独立变体（支持部分匹配）
      parts.forEach(part => {
        if (part.length > 1) {
          results.push(part);
        }
      });
    }
  }
  
  // 19. 空格分隔的单词 -> 连字符版本
  // 语音识别出 "old fashioned"，原文是 "old-fashioned"
  // 检测两个或三个单词的组合，生成连字符版本
  const words = w.split(/\s+/).filter(p => p.length > 0);
  if (words.length >= 2 && words.length <= 3) {
    // 生成连字符版本
    results.push(words.join('-'));
    // 也生成无分隔符版本
    results.push(words.join(''));
  }
  
  // 去重并返回
  return [...new Set(results.map(r => r.toLowerCase()))];
};

/**
 * 检查两个单词是否匹配（支持变体匹配）
 * 支持缩写词、数字、时间、货币等多种变体匹配
 */
const wordsMatchWithVariants = (targetWord: string, recognizedWord: string): boolean => {
  const targetLower = targetWord.toLowerCase();
  const recognizedLower = recognizedWord.toLowerCase();
  
  // 1. 直接匹配（使用原有的精确匹配逻辑）
  if (wordsMatch(targetLower, recognizedLower)) {
    return true;
  }
  
  // 2. 精确相等匹配（忽略引号格式差异）
  // 处理 "im" vs "i'm" 等情况：移除所有引号后比较
  const normalizeForCompare = (s: string) => s.replace(/['\u2018\u2019\u201A\u201B\u2032\u2035\u02B9\u02BB\u02BC\u02BD\uFF07\u0060\u00B4]/g, '').toLowerCase();
  if (normalizeForCompare(targetLower) === normalizeForCompare(recognizedLower)) {
    return true;
  }
  
  // 3. 生成目标词的所有变体
  const targetVariants = generateVariants(targetWord);
  
  // 4. 生成识别词的所有变体（反向匹配）
  const recognizedVariants = generateVariants(recognizedWord);
  
  // 5. 检查是否有任何变体匹配（使用精确相等或标准化比较）
  for (const tv of targetVariants) {
    for (const rv of recognizedVariants) {
      // 变体匹配时，尝试两种方式：精确相等 或 标准化后相等
      if (tv === rv || normalizeForCompare(tv) === normalizeForCompare(rv)) {
        return true;
      }
    }
  }
  
  // 6. 检查交叉匹配：目标词变体是否直接等于识别词（标准化后）
  for (const tv of targetVariants) {
    if (tv === recognizedLower || normalizeForCompare(tv) === normalizeForCompare(recognizedLower)) {
      return true;
    }
  }
  
  // 7. 检查识别词变体是否直接等于目标词（标准化后）
  for (const rv of recognizedVariants) {
    if (rv === targetLower || normalizeForCompare(rv) === normalizeForCompare(targetLower)) {
      return true;
    }
  }
  
  return false;
};

/**
 * 将连字符单词拆分成多个部分
 * 例如：cat-like -> ['cat', 'like']
 */
const splitHyphenatedWord = (word: string): string[] => {
  return word.split(/[-–—]/).filter(w => w.length > 0);
};

/**
 * 展开缩写词/缩约词（contractions）
 * 语音识别经常把缩写词拆开：it's → it is / it s / its
 * 
 * 支持的缩写词类型：
 * - 's: it's, he's, she's, that's, what's, who's, there's, here's
 * - 'm: I'm
 * - 're: you're, we're, they're
 * - 've: I've, you've, we've, they've
 * - 'd: I'd, you'd, he'd, she'd, we'd, they'd
 * - 'll: I'll, you'll, he'll, she'll, we'll, they'll
 * - n't: don't, doesn't, didn't, won't, wouldn't, shouldn't, couldn't, can't, isn't, aren't, wasn't, weren't, hasn't, haven't, hadn't
 * - 's (possessive): 不展开（John's 不变）
 * - let's: let us
 */
const expandContraction = (word: string): string[] => {
  const results: string[] = [];
  const w = word.toLowerCase().trim();
  
  // 缩写词映射表（双向映射）
  const contractionMap: Record<string, string[]> = {
    // 's = is (主谓一致)
    "it's": ["it is", "its", "it s"],
    "it is": ["it's", "its", "it s"],
    "he's": ["he is", "hes", "he s"],
    "he is": ["he's", "hes", "he s"],
    "she's": ["she is", "shes", "she s"],
    "she is": ["she's", "shes", "she s"],
    "that's": ["that is", "thats", "that s"],
    "that is": ["that's", "thats", "that s"],
    "what's": ["what is", "whats", "what s"],
    "what is": ["what's", "whats", "what s"],
    "who's": ["who is", "whos", "who s"],
    "who is": ["who's", "whos", "who s"],
    "where's": ["where is", "wheres", "where s"],
    "where is": ["where's", "wheres", "where s"],
    "when's": ["when is", "whens", "when s"],
    "when is": ["when's", "whens", "when s"],
    "why's": ["why is", "whys", "why s"],
    "why is": ["why's", "whys", "why s"],
    "how's": ["how is", "hows", "how s"],
    "how is": ["how's", "hows", "how s"],
    "there's": ["there is", "theres", "there s"],
    "there is": ["there's", "theres", "there s"],
    "here's": ["here is", "heres", "here s"],
    "here is": ["here's", "heres", "here s"],
    
    // 'm = am
    "i'm": ["i am", "im", "i m"],
    "i am": ["i'm", "im", "i m"],
    
    // 're = are
    "you're": ["you are", "youre", "you re"],
    "you are": ["you're", "youre", "you re"],
    "we're": ["we are", "were", "we re"],
    "we are": ["we're", "were", "we re"],
    "they're": ["they are", "theyre", "they re"],
    "they are": ["they're", "theyre", "they re"],
    
    // 've = have
    "i've": ["i have", "ive", "i ve"],
    "i have": ["i've", "ive", "i ve"],
    "you've": ["you have", "youve", "you ve"],
    "you have": ["you've", "youve", "you ve"],
    "we've": ["we have", "weve", "we ve"],
    "we have": ["we've", "weve", "we ve"],
    "they've": ["they have", "theyve", "they ve"],
    "they have": ["they've", "theyve", "they ve"],
    
    // 'd = would/had
    "i'd": ["i would", "i had", "id", "i d"],
    "i would": ["i'd", "id", "i d"],
    "i had": ["i'd", "id", "i d"],
    "you'd": ["you would", "you had", "youd", "you d"],
    "you would": ["you'd", "youd", "you d"],
    "you had": ["you'd", "youd", "you d"],
    "he'd": ["he would", "he had", "hed", "he d"],
    "he would": ["he'd", "hed", "he d"],
    "he had": ["he'd", "hed", "he d"],
    "she'd": ["she would", "she had", "shed", "she d"],
    "she would": ["she'd", "shed", "she d"],
    "she had": ["she'd", "shed", "she d"],
    "we'd": ["we would", "we had", "wed", "we d"],
    "we would": ["we'd", "wed", "we d"],
    "we had": ["we'd", "wed", "we d"],
    "they'd": ["they would", "they had", "theyd", "they d"],
    "they would": ["they'd", "theyd", "they d"],
    "they had": ["they'd", "theyd", "they d"],
    
    // 'll = will
    "i'll": ["i will", "ill", "i ll"],
    "i will": ["i'll", "ill", "i ll"],
    "you'll": ["you will", "youll", "you ll"],
    "you will": ["you'll", "youll", "you ll"],
    "he'll": ["he will", "hell", "he ll"],
    "he will": ["he'll", "hell", "he ll"],
    "she'll": ["she will", "shell", "she ll"],
    "she will": ["she'll", "shell", "she ll"],
    "we'll": ["we will", "well", "we ll"],
    "we will": ["we'll", "well", "we ll"],
    "they'll": ["they will", "theyll", "they ll"],
    "they will": ["they'll", "theyll", "they ll"],
    
    // n't = not
    "don't": ["do not", "dont", "don t"],
    "do not": ["don't", "dont", "don t"],
    "doesn't": ["does not", "doesnt", "doesn t"],
    "does not": ["doesn't", "doesnt", "doesn t"],
    "didn't": ["did not", "didnt", "didn t"],
    "did not": ["didn't", "didnt", "didn t"],
    "won't": ["will not", "wont", "won t"],
    "will not": ["won't", "wont", "won t"],
    "wouldn't": ["would not", "wouldnt", "wouldn t"],
    "would not": ["wouldn't", "wouldnts", "wouldn t"],
    "shouldn't": ["should not", "shouldnt", "shouldn t"],
    "should not": ["shouldn't", "shouldnt", "shouldn t"],
    "couldn't": ["could not", "couldnt", "couldn t"],
    "could not": ["couldn't", "couldnt", "couldn t"],
    "can't": ["cannot", "can not", "cant", "can t"],
    "cannot": ["can't", "cant", "can t"],
    "can not": ["can't", "cannot", "cant", "can t"],
    "isn't": ["is not", "isnt", "isn t"],
    "is not": ["isn't", "isnt", "isn t"],
    "aren't": ["are not", "arent", "aren t"],
    "are not": ["aren't", "arent", "aren t"],
    "wasn't": ["was not", "wasnt", "wasn t"],
    "was not": ["wasn't", "wasnt", "wasn t"],
    "weren't": ["were not", "werent", "weren t"],
    "were not": ["weren't", "werent", "weren t"],
    "hasn't": ["has not", "hasnt", "hasn t"],
    "has not": ["hasn't", "hasnt", "hasn t"],
    "haven't": ["have not", "havent", "haven t"],
    "have not": ["haven't", "havent", "haven t"],
    "hadn't": ["had not", "hadnt", "hadn t"],
    "had not": ["hadn't", "hadnt", "hadn t"],
    
    // let's = let us
    "let's": ["let us", "lets", "let s"],
    "let us": ["let's", "lets", "let s"],
  };
  
  // 检查是否是已知的缩写词（双向）
  if (contractionMap[w]) {
    results.push(...contractionMap[w]);
  }
  
  // 通用模式匹配：处理一些未在映射表中的缩写词
  // 模式1: word's -> word is / words (如: mom's -> mom is / moms)
  const sMatch = w.match(/^(.+)'s$/);
  if (sMatch && !contractionMap[w]) {
    const base = sMatch[1];
    // 如果是代词或常用词，展开为 is
    if (['this', 'that', 'everything', 'something', 'nothing', 'everyone', 'someone', 'anyone', 'nobody', 'somebody', 'everybody', 'anybody'].includes(base)) {
      results.push(`${base} is`);
      results.push(`${base}s`);
      results.push(`${base} s`);
    }
  }
  
  // 模式2: word'n't -> word not (处理一些不在映射表中的否定缩写)
  const ntMatch = w.match(/^(.+)n't$/);
  if (ntMatch && !contractionMap[w]) {
    const base = ntMatch[1];
    results.push(`${base} not`);
    results.push(`${base}nt`);
  }
  
  return results;
};

/**
 * 展开常见缩写词（abbreviations）
 * 语音识别经常把这些拆开：B.C. -> b c, A.D. -> a d, U.S. -> u s
 * 
 * 支持的缩写词类型：
 * - 时间相关：B.C. (Before Christ), A.D. (Anno Domini)
 * - 国家/组织：U.S. (United States), U.K. (United Kingdom), U.S.S.R., E.U., U.N.
 * - 其他常见：e.g., i.e., etc., vs., Mr., Mrs., Dr., Prof., St. (Street/Saint)
 */
const expandAbbreviation = (word: string): string[] => {
  const results: string[] = [];
  const w = word.toLowerCase().trim();
  
  // 缩写词映射表：标准形式 -> 可能的语音识别结果
  const abbrMap: Record<string, string[]> = {
    // 时间相关
    'b.c.': ['bc', 'b c', 'before christ', 'bce'],
    'bc': ['b.c.', 'b c', 'before christ', 'bce'],
    'bce': ['bc', 'b c', 'before common era', 'b.c.e.'],
    'a.d.': ['ad', 'a d', 'anno domini'],
    'ad': ['a.d.', 'a d', 'anno domini'],
    'c.e.': ['ce', 'c e', 'common era'],
    'ce': ['c.e.', 'c e', 'common era'],
    
    // 国家/地区
    'u.s.': ['us', 'u s', 'usa', 'u s a', 'united states'],
    'us': ['u.s.', 'u s', 'usa', 'u s a', 'united states'],
    'usa': ['u.s.', 'u s a', 'us', 'united states of america'],
    'u.k.': ['uk', 'u k', 'united kingdom'],
    'uk': ['u.k.', 'u k', 'united kingdom'],
    'u.s.s.r.': ['ussr', 'u s s r', 'soviet union'],
    'ussr': ['u.s.s.r.', 'u s s r', 'soviet union'],
    'e.u.': ['eu', 'e u', 'european union'],
    'eu': ['e.u.', 'e u', 'european union'],
    
    // 国际组织
    'u.n.': ['un', 'u n', 'united nations'],
    'un': ['u.n.', 'u n', 'united nations'],
    'n.a.t.o.': ['nato', 'n a t o', 'north atlantic treaty organization'],
    'nato': ['n.a.t.o.', 'n a t o'],
    'w.h.o.': ['who', 'w h o', 'world health organization'],
    'nasa': ['n.a.s.a.', 'n a s a', 'national aeronautics and space administration'],
    
    // 拉丁语缩写
    'e.g.': ['eg', 'e g', 'for example', 'example'],
    'i.e.': ['ie', 'i e', 'that is'],
    'etc.': ['etc', 'e t c', 'et cetera'],
    'vs.': ['vs', 'v s', 'versus'],
    'vs': ['vs.', 'v s', 'versus'],
    'cf.': ['cf', 'c f', 'compare'],
    'al.': ['al', 'a l'],
    'et al.': ['et al', 'et a l', 'and others'],
    
    // 称谓
    'mr.': ['mr', 'm r', 'mister'],
    'mr': ['mr.', 'm r', 'mister'],
    'mrs.': ['mrs', 'm r s', 'missus'],
    'mrs': ['mrs.', 'm r s', 'missus'],
    'ms.': ['ms', 'm s', 'miss'],
    'ms': ['ms.', 'm s', 'miss'],
    'dr.': ['dr', 'd r', 'doctor'],
    'dr': ['dr.', 'd r', 'doctor'],
    'prof.': ['prof', 'p r o f', 'professor'],
    'prof': ['prof.', 'p r o f', 'professor'],
    'sr.': ['sr', 's r', 'senior', 'sister'],
    'jr.': ['jr', 'j r', 'junior'],
    
    // 其他
    'st.': ['st', 's t', 'street', 'saint'],
    'st': ['st.', 's t', 'street', 'saint'],
    'ave.': ['ave', 'a v e', 'avenue'],
    'rd.': ['rd', 'r d', 'road'],
    'blvd.': ['blvd', 'b l v d', 'boulevard'],
    'apt.': ['apt', 'a p t', 'apartment'],
    'no.': ['no', 'n o', 'number'],
    'vol.': ['vol', 'v o l', 'volume'],
    'p.': ['p', 'page'],
    'pp.': ['pp', 'p p', 'pages'],
    'ch.': ['ch', 'c h', 'chapter'],
    'sec.': ['sec', 's e c', 'section'],
    'fig.': ['fig', 'f i g', 'figure'],
    'ref.': ['ref', 'r e f', 'reference'],
    'tel.': ['tel', 't e l', 'telephone'],
    'approx.': ['approx', 'a p p r o x', 'approximately'],
    'max.': ['max', 'm a x', 'maximum'],
    'min.': ['min', 'm i n', 'minimum'],
    'dept.': ['dept', 'd e p t', 'department'],
    'govt.': ['govt', 'g o v t', 'government'],
    'inc.': ['inc', 'i n c', 'incorporated'],
    'ltd.': ['ltd', 'l t d', 'limited'],
    'corp.': ['corp', 'c o r p', 'corporation'],
    'co.': ['co', 'c o', 'company'],
    'bro.': ['bro', 'b r o', 'brothers'],
    
    // 学术学位
    'b.a.': ['ba', 'b a', 'bachelor of arts'],
    'b.s.': ['bs', 'b s', 'bachelor of science'],
    'm.a.': ['ma', 'm a', 'master of arts'],
    'm.s.': ['ms', 'm s', 'master of science'],
    'ph.d.': ['phd', 'p h d', 'doctor of philosophy'],
    'mba': ['m.b.a.', 'm b a', 'master of business administration'],
    
    // 技术相关
    'i.d.': ['id', 'i d', 'identification'],
    'id': ['i.d.', 'i d', 'identification'],
    'url': ['u.r.l.', 'u r l', 'uniform resource locator'],
    'html': ['h.t.m.l.', 'h t m l'],
    'api': ['a.p.i.', 'a p i'],
    'cpu': ['c.p.u.', 'c p u', 'central processing unit'],
    'gpu': ['g.p.u.', 'g p u', 'graphics processing unit'],
    'ram': ['r.a.m.', 'r a m', 'random access memory'],
    'rom': ['r.o.m.', 'r o m', 'read only memory'],
    'usb': ['u.s.b.', 'u s b', 'universal serial bus'],
    'wifi': ['wi-fi', 'wi fi', 'wireless fidelity'],
    'wi-fi': ['wifi', 'wi fi'],
  };
  
  // 检查是否是已知的缩写词
  const lowerW = w.toLowerCase();
  if (abbrMap[lowerW]) {
    results.push(...abbrMap[lowerW]);
  }
  
  // 通用模式匹配：处理形如 "x.y." 或 "x.y.z." 的缩写词
  // 语音识别可能把 "U.S." 识别成 "u s" 或 "us"
  const dotPattern = w.replace(/\./g, ''); // 移除所有点
  if (dotPattern !== w && /^[a-z]+$/i.test(dotPattern)) {
    // 原词有点，移除点后的版本
    results.push(dotPattern);
    // 空格分开的版本
    results.push(dotPattern.split('').join(' '));
  }
  
  // 反向：原词没有点，但可能是缩写
  // 例如 "bc" -> "b.c.", "b c"
  if (!/\./.test(w) && /^[a-z]{2,}$/i.test(w)) {
    // 添加点分隔版本
    results.push(w.split('').join('.') + '.');
    // 添加空格分开版本
    results.push(w.split('').join(' '));
  }
  
  return results;
};

/**
 * 智能匹配：检查目标单词是否被识别（支持连字符拆分匹配、部分匹配和变体匹配）
 * 例如：targetWord="cat-like" 可以匹配 recognizedWords 中的 "cat" 和 "like"
 * 例如：targetWord="modern-looking" 可以匹配 recognizedWords 中的 "modern"（部分匹配）
 * 例如：targetWord="45" 可以匹配 recognizedWords 中的 "forty-five"
 */
const smartWordMatch = (
  targetWord: string,
  recognizedWords: string[],
  usedIndices: Set<number>
): { matched: boolean; usedIndices: number[] } => {
  const targetLower = targetWord.toLowerCase();
  
  // 先尝试直接匹配（支持变体）
  for (let i = 0; i < recognizedWords.length; i++) {
    if (usedIndices.has(i)) continue;
    if (wordsMatchWithVariants(targetLower, recognizedWords[i])) {
      return { matched: true, usedIndices: [i] };
    }
  }
  
  // 【新增】部分匹配：如果目标是连字符单词，识别词可能是其中一部分
  // 例如：目标是 "modern-looking"，用户说 "modern"
  if (/[-–—]/.test(targetLower)) {
    const parts = splitHyphenatedWord(targetLower);
    for (const part of parts) {
      for (let i = 0; i < recognizedWords.length; i++) {
        if (usedIndices.has(i)) continue;
        // 识别词与连字符单词的某一部分匹配
        if (wordsMatchWithVariants(part, recognizedWords[i])) {
          console.log(`[部分匹配] 目标 "${targetLower}" 的部分 "${part}" 匹配识别词 "${recognizedWords[i]}"`);
          return { matched: true, usedIndices: [i] };
        }
      }
    }
  }
  
  // 如果目标单词包含连字符，尝试拆分匹配（用户说了所有部分）
  const targetParts = splitHyphenatedWord(targetLower);
  if (targetParts.length > 1) {
    const foundIndices: number[] = [];
    let allPartsFound = true;
    
    for (const part of targetParts) {
      let partFound = false;
      for (let i = 0; i < recognizedWords.length; i++) {
        if (usedIndices.has(i) || foundIndices.includes(i)) continue;
        if (wordsMatchWithVariants(part, recognizedWords[i])) {
          foundIndices.push(i);
          partFound = true;
          break;
        }
      }
      if (!partFound) {
        allPartsFound = false;
        break;
      }
    }
    
    if (allPartsFound) {
      return { matched: true, usedIndices: foundIndices };
    }
  }
  
  return { matched: false, usedIndices: [] };
};

/**
 * 计算语音识别结果和目标句子的匹配度
 * 返回：
 * - score: 匹配度百分比(0-100)
 * - wordMatches: 目标句子中每个词的匹配状态
 * - recognizedWordMatches: 识别结果中每个词的匹配状态（用于显示绿色）
 */
const calculateMatchScore = (
  recognizedText: string, 
  targetText: string
): { 
  score: number; 
  wordMatches: Array<{ word: string; isMatch: boolean }>;
  recognizedWordMatches: Array<{ word: string; isMatch: boolean }>;
} => {
  // 预处理：转小写，统一引号格式，移除多余空格和标点
  // 【重要】与 extractWords 保持一致，保留单词内部的单引号（如 don't, what's）
  const cleanText = (text: string) => 
    text.toLowerCase()
      // 【新增】处理 extractWords 中使用的 Unicode 引号占位符
      // \u2774(❴)=左单引号, \u2775(❵)=右单引号, \u2772(❲)=左双引号, \u2773(❳)=右双引号
      .replace(/[\u2774\u2775\u2772\u2773]/g, ' ')
      // 统一所有类型的单引号为标准单引号（与 extractWords 一致）
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u02B9\u02BB\u02BC\u02BD\uFF07\u0060\u00B4]/g, "'")
      // 移除独立引号（单词外部的引号，如 'hello' 中的引号）
      .replace(/(?<![a-z])'(?![a-z])/g, ' ')
      .replace(/[""„‶❝❞]/g, ' ') // 将双引号替换为空格
      // 【修复】将所有类型的破折号和连字符都替换为空格
      // 这样 A-B 会被拆分成 A B，支持连接符单词的拆分匹配
      .replace(/[—–−-]/g, ' ')
      // 【关键修复】先处理缩写词中的句号，让字母分开
      // 例如：B.C. -> b c, A.D. -> a d, U.S. -> u s
      // 这样与 extractWords 的处理方式一致（缩写词被分成单独的字母）
      .replace(/([a-z])\.(?=[a-z]|$)/gi, '$1 ')
      .replace(/([a-z])\.(?=[a-z]|$)/gi, '$1 ') // 再次处理，处理连续的情况如 B.C.
      .replace(/[^\w\s']/g, '') // 移除标点符号（保留字母、数字、空格、单引号）
      .replace(/\s+/g, ' ')
      .trim();
  
  const recognized = cleanText(recognizedText);
  const target = cleanText(targetText);
  
  const targetWords = target.split(' ').filter(w => w.length > 0);
  const recognizedWords = recognized.split(' ').filter(w => w.length > 0);
  
  // 【调试日志】输出匹配详情
  console.log('[匹配调试] 目标文本:', targetText);
  console.log('[匹配调试] 清理后目标:', target);
  console.log('[匹配调试] 目标单词:', targetWords);
  console.log('[匹配调试] 识别文本:', recognizedText);
  console.log('[匹配调试] 清理后识别:', recognized);
  console.log('[匹配调试] 识别单词:', recognizedWords);
  
  if (targetWords.length === 0) {
    return { score: 0, wordMatches: [], recognizedWordMatches: [] };
  }
  
  // 为每个目标词找匹配
  const wordMatches: Array<{ word: string; isMatch: boolean }> = [];
  const usedIndices = new Set<number>();
  
  for (const targetWord of targetWords) {
    const result = smartWordMatch(targetWord, recognizedWords, usedIndices);
    wordMatches.push({ word: targetWord, isMatch: result.matched });
    if (result.matched) {
      result.usedIndices.forEach(idx => usedIndices.add(idx));
    }
    // 【调试日志】输出每个单词的匹配结果
    console.log(`[匹配调试] 目标词 "${targetWord}" -> ${result.matched ? '✓匹配' : '✗未匹配'}`);
  }
  
  // 计算识别结果中每个词的匹配状态
  // 使用原始识别文本来显示，保持缩写词格式（如 don't, what's）
  const originalWords = recognizedText.split(/\s+/).filter(w => w.length > 0);
  const recognizedWordMatches: Array<{ word: string; isMatch: boolean }> = 
    originalWords.map((word, idx) => {
      // 清理原始词来匹配 usedIndices
      const cleanedWord = cleanText(word);
      const cleanedIdx = recognizedWords.slice(0, idx + 1).filter(w => w.length > 0).length - 1;
      return {
        word, // 保留原始格式显示
        isMatch: usedIndices.has(cleanedIdx) || recognizedWords.some((rw, ri) => usedIndices.has(ri) && rw === cleanedWord)
      };
    });
  
  const matchedCount = wordMatches.filter(w => w.isMatch).length;
  const score = Math.round((matchedCount / targetWords.length) * 100);
  
  // 【调试日志】输出最终匹配度
  console.log(`[匹配调试] 匹配度: ${matchedCount}/${targetWords.length} = ${score}%`);
  
  return { score, wordMatches, recognizedWordMatches };
};

/**
 * 根据匹配度给出分段建议（长句子用）
 * 如果匹配度低于80%，建议用户分段练习
 */
const getSentenceSegmentSuggestion = (
  targetText: string,
  score: number
): string => {
  const words = targetText.split(' ').filter(w => w.length > 0);
  
  if (score >= 80) {
    return ''; // 匹配度高，不需要建议
  }
  
  if (words.length <= 6) {
    return '💡 短句子建议：慢慢朗读，注意每个词的发音';
  }
  
  if (words.length <= 10) {
    return `💡 建议分段：先练前半句（${Math.ceil(words.length / 2)}个词），再练后半句`;
  }
  
  // 长句子
  const segmentSize = Math.ceil(words.length / 3);
  return `💡 建议分三段练习：每段约${segmentSize}个词，逐段攻克`;
};

interface Sentence {
  id: number;
  text: string;
  sentence_index: number;
  start_time: number; // 秒
  end_time: number;   // 秒
  // 课程模式字段
  audio_url?: string; // 课程模式下的独立音频URL
  chinese_text?: string; // 中文翻译
  audio_duration?: number; // 音频时长（毫秒）
}

interface SentenceFile {
  id: number;
  title: string;
  original_audio_signed_url: string;
  original_duration: number;
  // 课程模式字段
  is_lesson?: boolean; // 是否为课程模式
  lesson_id?: number; // 课时ID
  voice_id?: string; // 音色ID
}

interface WordStatus {
  word: string;
  displayText: string;
  revealed: boolean;
  revealedChars: boolean[];
  errorCharIndex: number;
  index: number;
  isPunctuation: boolean;
}

// ============================================================
// 烟花粒子组件 - 超级加强版
// ============================================================

// 单个粒子（带拖尾效果）
interface ParticleProps {
  color: string;
  delay: number;
  startX: number;
  startY: number;
  angle: number;
  speed: number;
  size: number;
}

const Particle: React.FC<ParticleProps> = ({ color, delay, startX, startY, angle, speed, size }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(startY);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // 粒子爆炸
      scale.value = withSequence(
        withSpring(1.5, { damping: 6, stiffness: 200 }),
        withDelay(600, withTiming(0.3, { duration: 800 }))
      );
      
      // 向外飞散
      const distance = speed;
      translateX.value = withTiming(startX + Math.cos(angle) * distance, { duration: 1500 });
      translateY.value = withTiming(startY + Math.sin(angle) * distance, { duration: 1500 });
      
      // 旋转效果
      rotate.value = withTiming(360, { duration: 1500 });
      
      // 淡出
      opacity.value = withDelay(800, withTiming(0, { duration: 700 }));
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, angle, speed, startX, startY, scale, opacity, translateX, translateY, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
        },
        animatedStyle,
      ]}
    />
  );
};

// 闪烁星星背景
const Sparkle: React.FC<{ delay: number; x: number; y: number; color: string }> = ({ delay, x, y, color }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // 持续闪烁
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(200, withTiming(0.3, { duration: 300 })),
          withDelay(100, withTiming(1, { duration: 200 })),
          withDelay(300, withTiming(0, { duration: 400 }))
        ),
        -1,
        false
      );
      scale.value = withRepeat(
        withSequence(
          withSpring(1.2),
          withTiming(0.8)
        ),
        -1,
        true
      );
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: 6,
          height: 6,
        },
        animatedStyle,
      ]}
    >
      <FontAwesome6 name="star" size={6} color={color} />
    </Animated.View>
  );
};

// 烟花爆炸组件
interface FireworkProps {
  x: number;
  y: number;
  delay: number;
  colors: string[];
  particleCount?: number;
}

const Firework: React.FC<FireworkProps> = ({ x, y, delay, colors, particleCount = 24 }) => {
  const particles = useMemo(() => {
    const result = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      result.push({
        id: i,
        color: colors[i % colors.length],
        angle,
        speed: 80 + Math.random() * 60, // 随机速度
        size: 6 + Math.random() * 6, // 随机大小
      });
    }
    return result;
  }, [colors, particleCount]);

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      {particles.map((p) => (
        <Particle
          key={p.id}
          color={p.color}
          delay={delay + Math.random() * 100}
          startX={0}
          startY={0}
          angle={p.angle}
          speed={p.speed}
          size={p.size}
        />
      ))}
    </View>
  );
};

// 主烟花秀组件
const FireworkShow: React.FC = () => {
  const colors = useMemo(() => [
    '#FFD700', // 金色
    '#FF6B6B', // 珊瑚红
    '#4ECDC4', // 青绿
    '#A78BFA', // 紫罗兰
    '#F472B6', // 粉红
    '#60A5FA', // 天蓝
    '#FBBF24', // 橙黄
    '#34D399', // 翠绿
  ], []);

  // 随机生成星星位置
  const sparkles = useMemo(() => {
    const result = [];
    for (let i = 0; i < 20; i++) {
      result.push({
        id: i,
        x: Math.random() * 380,
        y: Math.random() * 400,
        delay: Math.random() * 500,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    return result;
  }, [colors]);

  return (
    <View style={completionStyles.fireworkContainer} pointerEvents="none">
      {/* 背景星星闪烁 */}
      {sparkles.map((s) => (
        <Sparkle key={s.id} delay={s.delay} x={s.x} y={s.y} color={s.color} />
      ))}
      
      {/* 多组烟花，不同位置和延迟 */}
      <Firework x={80} y={120} delay={0} colors={colors} particleCount={28} />
      <Firework x={200} y={80} delay={150} colors={colors} particleCount={32} />
      <Firework x={320} y={140} delay={300} colors={colors} particleCount={28} />
      <Firework x={140} y={200} delay={450} colors={colors} particleCount={24} />
      <Firework x={260} y={180} delay={600} colors={colors} particleCount={26} />
      
      {/* 第二波烟花 */}
      <Firework x={60} y={250} delay={800} colors={colors} particleCount={20} />
      <Firework x={200} y={220} delay={950} colors={colors} particleCount={30} />
      <Firework x={340} y={260} delay={1100} colors={colors} particleCount={20} />
    </View>
  );
};

// 课程完成弹窗组件 - 极致情绪价值版本（优化布局）
interface CompletionModalProps {
  visible: boolean;
  duration: number;
  sentenceCount: number;
  hasNextLesson: boolean; // 是否有下一课
  nextLessonTitle?: string; // 下一课标题
  onClose: () => void;
  theme: any;
  // 新增：统计数据
  typingAccuracy?: number;    // 打字准确率 0-100
  voiceAttempts?: number;     // 语音识别尝试次数
  voiceSuccesses?: number;    // 语音识别成功次数（点亮单词数）
  hintUsedCount?: number;     // 使用提示次数
  firstTryRate?: number;      // 首次正确率 0-100
}

// 彩虹屁文案库 - 精简版，只保留最有冲击力的
const RAINBOW_PRAISE = {
  // 速度相关
  speed: {
    ultra: { emoji: '⚡', title: '闪电侠！', subtitle: '这速度，键盘都要着火了！' },
    fast: { emoji: '🚀', title: '开挂了吧！', subtitle: '这效率，AI都要向你学习！' },
    normal: { emoji: '💪', title: '稳扎稳打！', subtitle: '节奏感满分！' },
    slow: { emoji: '🌟', title: '精益求精！', subtitle: '认真学习的样子最迷人！' },
  },
  // 准确率相关
  accuracy: {
    perfect: { emoji: '💎', title: '零失误！', subtitle: '每个字符都精准无误！' },
    high: { emoji: '🎯', title: '精准达人！', subtitle: '精准度堪比职业选手！' },
    medium: { emoji: '📈', title: '进步神速！', subtitle: '继续加油！' },
  },
  // 语音相关
  voice: {
    great: { emoji: '🎤', title: '口语小天才！', subtitle: '发音越来越地道了！' },
    good: { emoji: '🎵', title: '语音渐入佳境！', subtitle: '继续练习！' },
  },
};

// 获取主要表扬方向
const getMainPraise = (params: {
  avgTime: number;
  typingAccuracy: number;
  hasVoice: boolean;
  voiceSuccessRate: number;
  firstTryRate: number;
  hintUsedCount: number;
}) => {
  const { avgTime, typingAccuracy, hasVoice, voiceSuccessRate, firstTryRate, hintUsedCount } = params;
  
  // 优先级：真正零失误（首次正确率100% + 没用提示）> 速度极快 > 语音好 > 其他
  // 【重要】只有真正一遍过（每句话第一次就正确）才算"零失误"
  if (firstTryRate === 100 && hintUsedCount === 0) {
    return { ...RAINBOW_PRAISE.accuracy.perfect, badge: '完美主义者', highlight: '💎零失误' };
  }
  if (avgTime < 30) {
    return { ...RAINBOW_PRAISE.speed.ultra, badge: '闪电速度', highlight: '⚡神速' };
  }
  if (avgTime < 60) {
    return { ...RAINBOW_PRAISE.speed.fast, badge: '效率达人', highlight: '🚀高效' };
  }
  if (hasVoice && voiceSuccessRate >= 70) {
    return { ...RAINBOW_PRAISE.voice.great, badge: '口语之星', highlight: '🎤发音棒' };
  }
  if (typingAccuracy >= 95) {
    return { ...RAINBOW_PRAISE.accuracy.high, badge: '精准达人', highlight: '🎯精准' };
  }
  if (avgTime < 120) {
    return { ...RAINBOW_PRAISE.speed.normal, badge: '稳中求进', highlight: '💪稳扎稳打' };
  }
  return { ...RAINBOW_PRAISE.speed.slow, badge: '坚持不懈', highlight: '🌟用心' };
};

const CompletionModal: React.FC<CompletionModalProps> = ({
  visible,
  duration,
  sentenceCount,
  hasNextLesson,
  nextLessonTitle,
  onClose,
  theme,
  typingAccuracy = 100,
  voiceAttempts = 0,
  voiceSuccesses = 0,
  hintUsedCount = 0,
  firstTryRate = 100,
}) => {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  const bounceAnim = useRef(new RNAnimated.Value(0)).current;

  // 计算平均每句时间
  const avgTime = duration / Math.max(sentenceCount, 1);
  const hasVoice = voiceAttempts > 0;
  const voiceSuccessRate = voiceAttempts > 0 ? (voiceSuccesses / voiceAttempts) * 100 : 0;

  // 获取主要表扬
  const mainPraise = useMemo(() => {
    return getMainPraise({ avgTime, typingAccuracy, hasVoice, voiceSuccessRate, firstTryRate, hintUsedCount });
  }, [avgTime, typingAccuracy, hasVoice, voiceSuccessRate, firstTryRate, hintUsedCount]);

  // 格式化时长 - 紧凑格式
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`;
  };

  useEffect(() => {
    if (visible) {
      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        RNAnimated.loop(RNAnimated.sequence([
          RNAnimated.timing(bounceAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          RNAnimated.timing(bounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])),
      ]).start();
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        RNAnimated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      glowAnim.setValue(0);
      bounceAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  // 生成一行综合评语
  const summaryLine = `你是${mainPraise.highlight}的学习达人！`;

  return (
    <View style={completionStyles.completionOverlay}>
      <FireworkShow />
      <View style={completionStyles.completionBackdrop} />
      
      <RNAnimated.View
        style={[
          completionStyles.completionModal,
          { backgroundColor: theme.backgroundDefault, opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* 奖杯徽章 */}
        <RNAnimated.View 
          style={[
            completionStyles.badgeContainer, 
            { 
              backgroundColor: theme.primary,
              transform: [{ translateY: bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
            }
          ]}
        >
          <ThemedText variant="h1" color={theme.buttonPrimaryText}>🏆</ThemedText>
        </RNAnimated.View>

        {/* 主标题 */}
        <ThemedText variant="h2" color={theme.primary} style={completionStyles.completionTitle}>
          🎉 课程完成！
        </ThemedText>

        {/* 核心表扬 - 大字 */}
        <View style={completionStyles.praiseContainer}>
          <ThemedText variant="h2" color={theme.textPrimary}>
            {mainPraise.emoji} {mainPraise.title}
          </ThemedText>
          <ThemedText variant="bodyMedium" color={theme.textSecondary} style={{ marginTop: Spacing.xs }}>
            {mainPraise.subtitle}
          </ThemedText>
        </View>

        {/* 成就徽章 - 大字，最多2个 */}
        <View style={completionStyles.badgesRow}>
          <View style={[completionStyles.miniBadge, { backgroundColor: theme.accent + '20' }]}>
            <ThemedText variant="smallMedium" color={theme.accent}>⭐ {mainPraise.badge}</ThemedText>
          </View>
          {hintUsedCount === 0 && sentenceCount >= 5 && (
            <View style={[completionStyles.miniBadge, { backgroundColor: theme.success + '20' }]}>
              <ThemedText variant="smallMedium" color={theme.success}>⭐ 零提示</ThemedText>
            </View>
          )}
        </View>

        {/* 数据统计 - 紧凑一行 */}
        <View style={completionStyles.statsRow}>
          <View style={completionStyles.statCompact}>
            <FontAwesome6 name="clock" size={16} color={theme.primary} />
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>{formatDuration(duration)}</ThemedText>
          </View>
          <View style={completionStyles.statCompact}>
            <FontAwesome6 name="check-circle" size={16} color={theme.success} />
            <ThemedText variant="bodyMedium" color={theme.textPrimary}>{sentenceCount}句</ThemedText>
          </View>
          {hasVoice && (
            <View style={completionStyles.statCompact}>
              <FontAwesome6 name="microphone" size={16} color="#E91E63" />
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>{voiceAttempts}次语音</ThemedText>
            </View>
          )}
          {typingAccuracy < 100 && (
            <View style={completionStyles.statCompact}>
              <FontAwesome6 name="bullseye" size={16} color={theme.accent} />
              <ThemedText variant="bodyMedium" color={theme.textPrimary}>{typingAccuracy}%准确</ThemedText>
            </View>
          )}
        </View>

        {/* 综合评语 - 一行 */}
        <View style={[completionStyles.summaryBox, { backgroundColor: theme.primary + '10', borderLeftColor: theme.primary }]}>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>✨ {summaryLine}</ThemedText>
        </View>

        {/* 下一课提示 */}
        {hasNextLesson && nextLessonTitle && (
          <View style={[completionStyles.nextLessonHint, { backgroundColor: theme.backgroundTertiary }]}>
            <FontAwesome6 name="arrow-right" size={14} color={theme.primary} />
            <ThemedText variant="smallMedium" color={theme.textSecondary} style={{ marginLeft: Spacing.xs }}>
              下一课：{nextLessonTitle}
            </ThemedText>
          </View>
        )}

        {/* 确认按钮 */}
        <TouchableOpacity
          style={[completionStyles.completionButton, { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.4 }]}
          onPress={onClose}
          activeOpacity={0.9}
        >
          <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>
            {hasNextLesson ? '🚀 继续下一课' : '✨ 完成'}
          </ThemedText>
        </TouchableOpacity>
        
        {/* 结尾鼓励 - 放大 */}
        <ThemedText variant="smallMedium" color={theme.textMuted} style={{ marginTop: Spacing.md, textAlign: 'center' }}>
          💪 你今天的状态超棒，继续保持！
        </ThemedText>
      </RNAnimated.View>
    </View>
  );
};

// 烟花动画相关样式（需要在 createStyles 外部定义）
const completionStyles = StyleSheet.create({
  fireworkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  completionModal: {
    width: '90%',
    maxWidth: 380,
    borderRadius: 28,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  badgeContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -Spacing['2xl'],
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completionTitle: {
    textAlign: 'center',
  },
  praiseContainer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  miniBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  statCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  summaryBox: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: Spacing.lg,
  },
  achievementBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    marginBottom: Spacing.lg,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 16,
  },
  highlightBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    marginBottom: Spacing.md,
  },
  nextLessonHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  completionButton: {
    width: '100%',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
});

export default function SentencePracticeScreen() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ 
    fileId?: number; 
    title: string; 
    sentenceIndex?: number; 
    errorPriority?: boolean; 
    targetWord?: string; 
    targetCorrectCount?: number;
    singleSentenceMode?: string | boolean;
    // 课程模式参数
    sourceType?: 'file' | 'lesson';
    lessonId?: string;
    voiceId?: string;
    courseId?: string;
    courseTitle?: string;
    lessonNumber?: string;
  }>();
  const { user, isAuthenticated } = useAuth();

  const fileId = params.fileId;
  const sourceType = params.sourceType || 'file';
  const lessonId = params.lessonId;
  const voiceId = params.voiceId;
  const courseId = params.courseId;
  const courseTitle = params.courseTitle;
  const lessonNumber = params.lessonNumber;
  const practiceTitle = params.title;

  const [file, setFile] = useState<SentenceFile | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const sentencesRef = useRef<Sentence[]>([]); // 用于在 cleanup 中获取最新的 sentences
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0); // 用于在 cleanup 中获取最新的 currentIndex
  const [loading, setLoading] = useState(true);
  const [resumingFromProgress, setResumingFromProgress] = useState(false); // 是否从进度恢复
  const resumingFromProgressRef = useRef(false); // 用于在 useEffect 中检查最新状态
  const [errorPriority, setErrorPriority] = useState(params.errorPriority || false); // 错题优先模式
  const [errorSentences, setErrorSentences] = useState<Array<{ sentence_index: number; totalErrors: number }>>([]); // 错题句子列表
  const hasShownProgressAlert = useRef(false); // 是否已经显示过进度弹窗（防止重复弹出）
  
  // 课程模式：下一课时信息（用于学完自动跳转）
  const [nextLessonId, setNextLessonId] = useState<number | null>(null);
  const [nextLessonTitle, setNextLessonTitle] = useState<string>('');
  const [nextLessonNumber, setNextLessonNumber] = useState<number>(0);
  
  // 薄弱词汇练习：目标单词追踪
  const targetWord = params.targetWord ? (params.targetWord as string).toLowerCase() : null;
  const targetCorrectCount = params.targetCorrectCount ? Number(params.targetCorrectCount) : 0;
  const singleSentenceMode = params.singleSentenceMode === 'true' || params.singleSentenceMode === true;
  const targetWordCorrectRef = useRef(0); // 目标单词已正确次数
  const shouldReturnAfterSentenceRef = useRef(false); // 是否在句子完成后返回

  // 单词状态
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [targetWordIndex, setTargetWordIndex] = useState<number | null>(null); // 当前正在匹配的单词索引
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null); // 延迟确认定时器

  // 单词提示和翻译
  const [hintWordIndex, setHintWordIndex] = useState<number | null>(null); // 显示提示的单词
  const inputRef = useRef<TextInput>(null); // 输入框引用，用于点击提示后恢复焦点
  const [translationWordIndex, setTranslationWordIndex] = useState<number | null>(null); // 显示翻译的单词
  const [wordTranslations, setWordTranslations] = useState<Record<string, string>>({}); // 单词翻译缓存
  const [wordPhonetics, setWordPhonetics] = useState<Record<string, string>>({}); // 单词音标缓存
  const [wordContextMeanings, setWordContextMeanings] = useState<Record<string, string>>({}); // 单词在句子中的意思缓存

  // 翻译显示
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState('');

  // 句子积分累积（仅后台记录，不显示弹窗）
  const currentSentencePointsRef = useRef(0);

  // 学习统计数据收集（用于课程完成时生成彩虹屁）
  const statsRef = useRef({
    totalKeystrokes: 0,        // 总按键次数
    correctKeystrokes: 0,      // 正确按键次数
    voiceAttempts: 0,          // 语音识别尝试次数
    voiceSuccesses: 0,         // 语音识别成功次数（点亮单词）
    hintUsedCount: 0,          // 使用提示次数
    skipCount: 0,              // 跳过次数
    firstTryCorrect: 0,        // 首次尝试就正确的句子数
    totalSentences: 0,         // 总句子数
  });

  // 课程完成弹窗状态
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionDuration, setCompletionDuration] = useState(0); // 学习时长（秒）
  const [completionStats, setCompletionStats] = useState({  // 完成时的统计数据
    typingAccuracy: 0,
    voiceAttempts: 0,
    voiceSuccesses: 0,
    hintUsedCount: 0,
    firstTryRate: 0,
  });

  // 学习时长计时器 - 带空闲超时检测
  // 逻辑：
  // 1. 音频在循环播放 = 用户在学习 = 持续计时
  // 2. 音频停止 + 60秒没操作 = 用户发呆 = 停止计时
  const sessionStartTimeRef = useRef<number | null>(null); // 当前计时周期的开始时间
  const lastActivityTimeRef = useRef<number | null>(null); // 最后一次活动时间
  const accumulatedDurationRef = useRef<number>(0); // 已累计的有效学习时长（秒）
  const INACTIVITY_TIMEOUT = 60 * 1000; // 60秒无操作超时
  
  // 记录用户活动（在用户有任何操作时调用）
  const recordActivity = useCallback(() => {
    const now = Date.now();
    
    // 如果之前处于空闲状态（音频停止 + 超过60秒没操作），重新开始计时
    if (lastActivityTimeRef.current && now - lastActivityTimeRef.current > INACTIVITY_TIMEOUT && !isLoopingRef.current) {
      // 空闲期间不计时，从现在重新开始
      sessionStartTimeRef.current = now;
      console.log('[学习时长] 检测到用户恢复活动，重新开始计时');
    }
    
    lastActivityTimeRef.current = now;
  }, []);
  
  // 计算有效学习时长
  // 关键逻辑：音频在循环播放时，持续计时（用户在听）
  const calculateEffectiveDuration = useCallback((): number => {
    if (!sessionStartTimeRef.current) {
      return accumulatedDurationRef.current;
    }
    
    const now = Date.now();
    const lastActivity = lastActivityTimeRef.current || sessionStartTimeRef.current;
    const timeSinceLastActivity = now - lastActivity;
    
    // 如果音频在循环播放，持续计时（用户在听音频学习）
    if (isLoopingRef.current) {
      const currentDuration = (now - sessionStartTimeRef.current) / 1000;
      return accumulatedDurationRef.current + Math.max(0, currentDuration);
    }
    
    // 音频已停止，检查空闲超时
    if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
      // 超时，只计算到最后一次活动的时间
      const effectiveDuration = (lastActivity - sessionStartTimeRef.current) / 1000;
      return accumulatedDurationRef.current + Math.max(0, effectiveDuration);
    } else {
      // 未超时，继续计时
      const currentDuration = (now - sessionStartTimeRef.current) / 1000;
      return accumulatedDurationRef.current + Math.max(0, currentDuration);
    }
  }, []);
  
  // 存档状态
  const [hasProgressToSave, setHasProgressToSave] = useState(false); // 是否有进度需要存档
  const isExitingRef = useRef(false); // 是否正在退出（防止重复处理）
  const initialIndexRef = useRef<number | null>(null); // 初始句子索引（用于判断是否有进度变化）

  // 音频播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef(true);
  const isLoopingRef = useRef(true);
  const volumeRef = useRef(1.0);
  const playbackRateRef = useRef(1.0);

  // 键盘类型：'system' 手机键盘 | 'custom' 自建键盘
  const [keyboardType, setKeyboardType] = useState<'system' | 'custom'>('system');
  const [showNumberPanel, setShowNumberPanel] = useState(false); // 显示数字面板

  // 错误闪烁动画
  const errorAnimRef = useRef<RNAnimated.Value>(new RNAnimated.Value(0));

  // 语音输入
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingPermission, setHasRecordingPermission] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null); // 长按录音延迟计时器
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null); // 触摸起点
  
  // 语音答题模式
  const [voicePracticeMode, setVoicePracticeMode] = useState<VoicePracticeMode>('auto-match');
  const voicePracticeModeRef = useRef<VoicePracticeMode>('auto-match'); // 用于在回调中获取最新值
  
  // 跟随朗读模式的当前进度索引（必须按顺序念）
  const followAlongIndexRef = useRef<number>(0);
  
  // 智能引导模式的当前攻克单词索引
  const smartGuideIndexRef = useRef<number>(0);
  
  // 语音识别结果
  const [showVoiceResult, setShowVoiceResult] = useState(false);
  const [voiceResultText, setVoiceResultText] = useState('');
  const [voiceMatchScore, setVoiceMatchScore] = useState(0);
  const [voiceWordMatches, setVoiceWordMatches] = useState<Array<{ word: string; isMatch: boolean }>>([]);
  const [voiceSentenceSuggestion, setVoiceSentenceSuggestion] = useState(''); // 长句子分段建议
  const [voiceTargetWord, setVoiceTargetWord] = useState<string | null>(null); // 当前要重读的单词
  const [remainingWordsCount, setRemainingWordsCount] = useState(0); // 剩余未完成单词数
  const [recognizedWordMatches, setRecognizedWordMatches] = useState<Array<{ word: string; isMatch: boolean }>>([]); // 识别结果中每个词的匹配状态
  
  // 完美发音记录 & 音频源选择
  const [showAudioSourcePanel, setShowAudioSourcePanel] = useState(false); // 显示音频源选择面板
  const [perfectRecordings, setPerfectRecordings] = useState<Array<any>>([]); // 完美发音列表
  const [publicRecordings, setPublicRecordings] = useState<Array<any>>([]); // 其他用户分享的发音
  const lastRecordingUriRef = useRef<string | null>(null); // 最后一次录音的URI
  const sentenceStartedWithVoiceRef = useRef(false); // 当前句子是否以语音模式开始
  const sentenceHadTypingRef = useRef(false); // 当前句子是否有过打字输入
  const sentenceHadVoiceErrorRef = useRef(false); // 当前句子是否有过语音识别错误
  const sentenceUsedHintRef = useRef(false); // 当前句子是否使用过提示
  const wasPlayingBeforePanelRef = useRef(false); // 打开面板前是否在播放
  const wasPlayingBeforeRecordingRef = useRef(false); // 开始录音前是否在播放
  const isStartingRecordingRef = useRef(false); // 正在启动录音（用于 onTouchEnd 检测）
  const previewSoundRef = useRef<Audio.Sound | null>(null); // 预览音频播放器
  
  // 音频源选择状态
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]); // 选中的音源ID列表
  const [currentPlayingSourceIndex, setCurrentPlayingSourceIndex] = useState(0); // 当前播放的音源索引
  const selectedSourceIdsRef = useRef<string[]>([]); // 用于在回调中获取最新值
  const currentPlayingSourceIndexRef = useRef(0); // 用于在回调中获取最新值
  const aiVoicesRef = useRef<Array<{id: string; name: string; voiceId: string}>>([
    { id: 'ai_weiwei', name: '薇薇（双语女声）', voiceId: 'zh_female_vv_uranus_bigtts' },
    { id: 'ai_xiaohe', name: '晓荷（中文女声）', voiceId: 'zh_female_xiaohe_uranus_bigtts' },
    { id: 'ai_yunzhou', name: '云舟（中文男声）', voiceId: 'zh_male_m191_uranus_bigtts' },
    { id: 'ai_xiaotian', name: '晓天（中文男声）', voiceId: 'zh_male_taocheng_uranus_bigtts' },
  ]); // 四种AI音色

  // 同步 ref 和 state
  useEffect(() => {
    selectedSourceIdsRef.current = selectedSourceIds;
  }, [selectedSourceIds]);
  
  useEffect(() => {
    currentPlayingSourceIndexRef.current = currentPlayingSourceIndex;
  }, [currentPlayingSourceIndex]);

  const currentSentence = sentences[currentIndex];
  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;

  // 每句答对后的短情绪价值
  const [sentencePraise, setSentencePraise] = useState<string | null>(null);
  const sentencePraiseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 播放一遍过音效（简短清脆）
  const playPraiseSound = useCallback(async () => {
    let sound: Audio.Sound | null = null;
    try {
      // 使用简短清脆的成功音效
      const result = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3' },
        { volume: 0.6 }
      );
      sound = result.sound;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound?.unloadAsync().catch(() => {});
        }
      });
      
      await sound.playAsync();
    } catch (error) {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    }
  }, []);
  
  const showSentencePraise = useCallback((wordCount: number) => {
    // 长句子（10个单词以上）给更高的情绪价值 - 约60种
    const longSentencePraises = [
      // 🏆 顶级赞美
      '🏆 Masterful!', '🏆 Triumphant!', '🏆 Victorious!', '🏆 Supreme!',
      // 🌟 卓越赞美
      '🌟 Outstanding!', '🌟 Exceptional!', '🌟 Extraordinary!', '🌟 Remarkable!',
      // 💎 珍贵赞美
      '💎 Phenomenal!', '💎 Magnificent!', '💎 Splendid!', '💎 Glorious!',
      // 🚀 动力赞美
      '🚀 Incredible!', '🚀 Sensational!', '🚀 Stupendous!', '🚀 Prodigious!',
      // 👑 皇家赞美
      '👑 Legendary!', '👑 Majestic!', '👑 Imperial!', '👑 Regal!',
      // ⭐ 星级赞美
      '⭐ Superb!', '⭐ Stellar!', '⭐ Dazzling!', '⭐ Radiant!',
      // 🎯 精准赞美
      '🎯 Flawless!', '🎯 Impeccable!', '🎯 Exquisite!', '🎯 Pristine!',
      // 💫 梦幻赞美
      '💫 Breathtaking!', '💫 Mesmerizing!', '💫 Enchanting!', '💫 Magical!',
      // 🔥 热情赞美
      '🔥 Spectacular!', '🔥 Dazzling!', '🔥 Electrifying!', '🔥 Sizzling!',
      // 💪 力量赞美
      '💪 Dominating!', '💪 Unstoppable!', '💪 Unbeatable!', '💪 Formidable!',
      // 🎪 表演赞美
      '🎪 Showstopping!', '🎪 Jaw-dropping!', '🎪 Mind-blowing!', '🎪 Earth-shattering!',
      // 🌈 彩虹赞美
      '🌈 Brilliant!', '🌈 Shining!', '🌈 Gleaming!', '🌈 Sparkling!',
      // ⚡ 闪电赞美
      '⚡ Thunderous!', '⚡ Explosive!', '⚡ Dynamic!', '⚡ Powerful!',
    ];
    
    // 普通句子的情绪价值 - 约60种
    const normalPraises = [
      // ✨ 完美系列
      '✨ Perfect!', '✨ Great!', '✨ Nice!', '✨ Super!',
      // 🎯 精准系列
      '🎯 Spot on!', '🎯 Right on!', '🎯 Bullseye!', '🎯 Precise!',
      // ⚡ 速度系列
      '⚡ Lightning fast!', '⚡ Quick!', '⚡ Speedy!', '⚡ Rapid!',
      // 🔥 热情系列
      '🔥 Brilliant!', '🔥 Hot!', '🔥 On fire!', '🔥 Blazing!',
      // 💪 力量系列
      '💪 Amazing!', '💪 Strong!', '💪 Solid!', '💪 Powerful!',
      // 🌟 星光系列
      '🌟 Excellent!', '🌟 Wonderful!', '🌟 Marvelous!', '🌟 Terrific!',
      // 🚀 动力系列
      '🚀 Fantastic!', '🚀 Awesome!', '🚀 Cool!', '🚀 Great job!',
      // 💯 满分系列
      '💯 Top notch!', '💯 First class!', '💯 A-plus!', '💯 Gold star!',
      // 🎉 庆祝系列
      '🎉 Well done!', '🎉 Good job!', '🎉 Nice work!', '🎉 Great work!',
      // 👏 鼓掌系列
      '👏 Impressive!', '👏 Admirable!', '👏 Praiseworthy!', '👏 Commendable!',
      // 🌺 花朵系列
      '🌺 Beautiful!', '🌺 Lovely!', '🌺 Gorgeous!', '🌺 Stunning!',
      // 🎵 音乐系列
      '🎵 Harmonious!', '🎵 Rhythmic!', '🎵 Melodic!', '🎵 In tune!',
      // 🏅 奖牌系列
      '🏅 Gold medal!', '🏅 Champion!', '🏅 Winner!', '🏅 Top tier!',
    ];
    
    // 根据单词数量选择情绪价值数组
    const praises = wordCount >= 10 ? longSentencePraises : normalPraises;
    const randomPraise = praises[Math.floor(Math.random() * praises.length)];
    setSentencePraise(randomPraise);
    
    // 播放音效
    playPraiseSound();
    
    // 清除之前的定时器
    if (sentencePraiseTimeoutRef.current) {
      clearTimeout(sentencePraiseTimeoutRef.current);
    }
    
    // 2秒后隐藏（与翻译显示时间一致）
    sentencePraiseTimeoutRef.current = setTimeout(() => {
      setSentencePraise(null);
    }, 2000);
  }, [playPraiseSound]);

  // 当切换句子时，重置跟随朗读和智能引导的进度，以及音源索引
  useEffect(() => {
    followAlongIndexRef.current = 0;
    smartGuideIndexRef.current = 0;
    // 切换句子时重置音源索引
    currentPlayingSourceIndexRef.current = 0;
    setCurrentPlayingSourceIndex(0);
    // 停止当前播放
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
    
    // 清除情绪价值
    if (sentencePraiseTimeoutRef.current) {
      clearTimeout(sentencePraiseTimeoutRef.current);
      sentencePraiseTimeoutRef.current = null;
    }
    setSentencePraise(null);
  }, [currentIndex]);

  // 初始化默认选中的音源（选中当前voiceId对应的AI音色）
  useEffect(() => {
    if (selectedSourceIds.length === 0 && voiceId) {
      // 根据当前voiceId找到对应的AI音色ID
      const matchedVoice = aiVoicesRef.current.find(v => v.voiceId === voiceId);
      if (matchedVoice) {
        setSelectedSourceIds([matchedVoice.id]);
        console.log(`[音源初始化] 默认选中AI音色: ${matchedVoice.name}`);
      } else {
        // 如果没有匹配，默认选中第一个AI音色
        setSelectedSourceIds([aiVoicesRef.current[0].id]);
        console.log(`[音源初始化] 默认选中第一个AI音色: ${aiVoicesRef.current[0].name}`);
      }
    }
  }, [voiceId, selectedSourceIds.length]);

  // 初始化录音权限
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setHasRecordingPermission(status === 'granted');
      } catch (error) {
        console.log('[权限] 请求麦克风权限失败:', error);
        setHasRecordingPermission(false);
      }
    })();
  }, []);

  // 加载语音答题模式设置
  useEffect(() => {
    (async () => {
      const mode = await getVoicePracticeMode();
      setVoicePracticeMode(mode);
      voicePracticeModeRef.current = mode;
      console.log('[语音答题模式] 已加载:', mode);
    })();
  }, []);

  // 当模式切换时，重置相关状态并显示提示
  useEffect(() => {
    // 重置进度索引
    followAlongIndexRef.current = 0;
    smartGuideIndexRef.current = 0;
    
    // 清除语音结果
    setShowVoiceResult(false);
    setVoiceTargetWord(null);
    
    console.log('[语音答题模式] 模式切换，重置进度');
  }, [voicePracticeMode]);

  // 更新剩余单词数量
  useEffect(() => {
    const remaining = wordStatuses.filter(ws => !ws.isPunctuation && !ws.revealed).length;
    setRemainingWordsCount(remaining);
  }, [wordStatuses]);

  // 加载可学习的句子
  const fetchSentences = useCallback(async () => {
    // 课程模式：使用课程API
    if (sourceType === 'lesson' && lessonId) {
      setLoading(true);
      try {
        /**
         * 服务端文件：server/src/routes/courses.ts
         * 接口：GET /api/v1/courses/lessons/:lessonId/learnable
         * Path 参数：lessonId: string
         * Query 参数：voiceId?: string
         */
        const url = new URL(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/lessons/${lessonId}/learnable`);
        if (voiceId) {
          url.searchParams.append('voiceId', voiceId);
        }
        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.sentences) {
          setFile(data.file);
          setSentences(data.sentences);
          console.log(`[课程学习] 加载了 ${data.sentences.length} 个句子`);
          
          // 如果有传入指定的句子索引，直接跳转
          if (params.sentenceIndex !== undefined && params.sentenceIndex < data.sentences.length) {
            setCurrentIndex(params.sentenceIndex);
            initialIndexRef.current = params.sentenceIndex; // 记录初始索引
          } else {
            // 检查本地进度
            const progressId = lessonId;
            
            if (progressId && !hasShownProgressAlert.current) {
              hasShownProgressAlert.current = true;
              
              // 先检查本地进度
              const localProgress = await getLocalProgress('lesson', progressId);
              
              if (localProgress && !localProgress.completed && localProgress.sentenceIndex >= 0 && localProgress.sentenceIndex < data.sentences.length) {
                // 有本地进度且未完成
                setResumingFromProgress(true);
                Alert.alert(
                  '继续学习',
                  `上次学习到第 ${localProgress.sentenceIndex + 1} 句（共 ${localProgress.totalSentences} 句），是否继续？`,
                  [
                    { 
                      text: '从头开始', 
                      onPress: () => {
                        setCurrentIndex(0);
                        initialIndexRef.current = 0;
                        setResumingFromProgress(false);
                      }
                    },
                    { 
                      text: '继续学习', 
                      style: 'default',
                      onPress: () => {
                        setCurrentIndex(localProgress.sentenceIndex);
                        initialIndexRef.current = localProgress.sentenceIndex;
                        setResumingFromProgress(false);
                      }
                    }
                  ]
                );
              } else {
                // 无本地进度，从头开始
                initialIndexRef.current = 0;
              }
            }
          }
        }
      } catch (error) {
        console.error('加载课程句子失败:', error);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // 句库模式：使用原有API
    if (!fileId) return;

    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/sentence-files.ts
       * 接口：GET /api/v1/sentence-files/:id/learnable
       * Path 参数：id: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/sentence-files/${fileId}/learnable`);
      const data = await response.json();

      if (data.sentences) {
        setFile(data.file);
        let loadedSentences = data.sentences;
        console.log(`[句库学习] 加载了 ${data.sentences.length} 个可学习句子`);
        
        // 如果是错题优先模式且不是单句模式，获取错题句子列表并重新排序
        // 单句模式下不排序，直接跳转到指定句子
        if (errorPriority && !singleSentenceMode && isAuthenticated && user?.id) {
          try {
            /**
             * 服务端文件：server/src/routes/error-words.ts
             * 接口：GET /api/v1/error-words/sentences
             * Query 参数：user_id: string, sentence_file_id: number
             */
            const errorResponse = await fetch(
              `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/sentences?user_id=${user.id}&sentence_file_id=${fileId}`
            );
            const errorData = await errorResponse.json();
            
            if (errorData.success && errorData.data && errorData.data.length > 0) {
              setErrorSentences(errorData.data);
              
              const errorIndexSet = new Set(errorData.data.map((e: { sentence_index: number }) => e.sentence_index));
              
              // 将有错题的句子移到前面
              const errorSentencesList = loadedSentences.filter((s: Sentence) => errorIndexSet.has(s.sentence_index));
              const normalSentencesList = loadedSentences.filter((s: Sentence) => !errorIndexSet.has(s.sentence_index));
              
              loadedSentences = [...errorSentencesList, ...normalSentencesList];
              console.log(`[错题优先] 已将 ${errorSentencesList.length} 个错题句子移到前面`);
            }
          } catch (errorError) {
            console.log('[错题优先] 获取错题句子失败:', errorError);
          }
        }
        
        setSentences(loadedSentences);
        statsRef.current.totalSentences = loadedSentences.length; // 记录总句子数
        
        // 如果有传入指定的句子索引，直接跳转
        if (params.sentenceIndex !== undefined && params.sentenceIndex < loadedSentences.length) {
          setCurrentIndex(params.sentenceIndex);
          initialIndexRef.current = params.sentenceIndex; // 记录初始索引
        } else {
          // 获取学习进度（优先本地缓存，再服务端）
          // 课程模式使用 lessonId，句库模式使用 fileId
          const progressId = sourceType === 'lesson' ? lessonId : fileId;
          
          if (progressId && !errorPriority && !hasShownProgressAlert.current) {
            hasShownProgressAlert.current = true; // 标记已显示过弹窗
            
            // 1. 先检查本地进度
            const localProgress = await getLocalProgress(sourceType, progressId);
            
            if (localProgress && !localProgress.completed && localProgress.sentenceIndex >= 0 && localProgress.sentenceIndex < loadedSentences.length) {
              // 有本地进度且未完成
              setResumingFromProgress(true);
              Alert.alert(
                '继续学习',
                `上次学习到第 ${localProgress.sentenceIndex + 1} 句（共 ${localProgress.totalSentences} 句），是否继续？`,
                [
                  { 
                    text: '从头开始', 
                    onPress: () => {
                      setCurrentIndex(0);
                      initialIndexRef.current = 0;
                      setResumingFromProgress(false);
                    }
                  },
                  { 
                    text: '继续学习', 
                    style: 'default',
                    onPress: () => {
                      setCurrentIndex(localProgress.sentenceIndex);
                      initialIndexRef.current = localProgress.sentenceIndex;
                      setResumingFromProgress(false);
                    }
                  }
                ]
              );
            } else if (isAuthenticated && user?.id) {
              // 2. 本地无进度，检查服务端进度
              try {
                /**
                 * 服务端文件：server/src/routes/learning.ts
                 * 接口：GET /api/v1/learning-records/progress/:fileId
                 * Query 参数：user_id: string
                 */
                const progressResponse = await fetch(
                  `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/progress/${progressId}?user_id=${user.id}`
                );
                const progressData = await progressResponse.json();
                
                if (progressData.success && progressData.progress) {
                  const savedIndex = progressData.progress.lastSentenceIndex;
                  // 只要有进度（savedIndex >= 0），就询问是否继续
                  if (savedIndex >= 0 && savedIndex < loadedSentences.length) {
                    // 同步保存到本地
                    await saveLocalProgress(sourceType, progressId, {
                      sentenceIndex: savedIndex,
                      totalSentences: loadedSentences.length,
                      updatedAt: Date.now(),
                      completed: false,
                    });
                    
                    setResumingFromProgress(true);
                    Alert.alert(
                      '继续学习',
                      `上次学习到第 ${savedIndex + 1} 句，是否继续？`,
                      [
                        { 
                          text: '从头开始', 
                          onPress: () => {
                            setCurrentIndex(0);
                            initialIndexRef.current = 0;
                            setResumingFromProgress(false);
                          }
                        },
                        { 
                          text: '继续学习', 
                          onPress: () => {
                            setCurrentIndex(savedIndex);
                            initialIndexRef.current = savedIndex;
                            setResumingFromProgress(false);
                          }
                        }
                      ]
                    );
                  } else {
                    // 进度超出范围，从头开始
                    initialIndexRef.current = 0;
                  }
                } else {
                  // 没有进度记录，初始索引为0
                  initialIndexRef.current = 0;
                }
              } catch (progressError) {
                console.log('[学习进度] 获取进度失败:', progressError);
                initialIndexRef.current = 0;
              }
            } else {
              // 不需要检查进度，初始索引为0
              initialIndexRef.current = 0;
            }
          }
        }
      }
    } catch (error) {
      console.error('加载句子失败:', error);
    } finally {
      setLoading(false);
    }
  }, [fileId, isAuthenticated, user?.id, errorPriority, params.sentenceIndex, sourceType, lessonId, voiceId]);

  // 课程模式：获取下一课时信息（用于学完自动跳转）
  const fetchNextLesson = useCallback(async () => {
    if (sourceType !== 'lesson' || !courseId || !lessonNumber) return;
    
    try {
      /**
       * 服务端文件：server/src/routes/courses.ts
       * 接口：GET /api/v1/courses/:courseId/lessons
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/courses/${courseId}/lessons`);
      const data = await response.json();
      
      if (data.lessons) {
        const currentNum = parseInt(lessonNumber, 10);
        // 找到下一个课时（lesson_number = 当前编号 + 1）
        const nextLesson = data.lessons.find((l: { lesson_number: number }) => l.lesson_number === currentNum + 1);
        
        if (nextLesson) {
          setNextLessonId(nextLesson.id);
          setNextLessonTitle(nextLesson.title);
          setNextLessonNumber(nextLesson.lesson_number);
          console.log(`[课程学习] 找到下一课: 第${nextLesson.lesson_number}课 - ${nextLesson.title}`);
        } else {
          console.log('[课程学习] 没有下一课了');
        }
      }
    } catch (error) {
      console.error('[课程学习] 获取下一课时失败:', error);
    }
  }, [sourceType, courseId, lessonNumber]);

  // 获取完美发音列表（当前句子）
  const fetchPerfectRecordings = useCallback(async () => {
    console.log(`[fetchPerfectRecordings] 开始获取, isAuthenticated: ${isAuthenticated}, userId: ${user?.id}, sentenceId: ${currentSentence?.id}`);
    if (!isAuthenticated || !user?.id || !currentSentence?.id) {
      console.log(`[fetchPerfectRecordings] 条件不满足，跳过获取`);
      return;
    }

    try {
      /**
       * 服务端文件：server/src/routes/perfect-recordings.ts
       * 接口：GET /api/v1/perfect-recordings
       * Query 参数：userId: string, sentenceId?: number, limit?: number
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings?userId=${user.id}&sentenceId=${currentSentence.id}&limit=10`
      );
      const data = await response.json();

      console.log(`[fetchPerfectRecordings] 获取结果: ${JSON.stringify(data)}`);
      if (data.success) {
        setPerfectRecordings(data.data || []);
        console.log(`[fetchPerfectRecordings] 设置了 ${data.data?.length || 0} 条记录`);
      }
    } catch (error) {
      console.error('获取完美发音列表失败:', error);
    }
  }, [isAuthenticated, user?.id, currentSentence?.id]);

  // 获取其他用户分享的发音（当前句子）
  const fetchPublicRecordings = useCallback(async () => {
    console.log(`[fetchPublicRecordings] 开始获取, sentenceId: ${currentSentence?.id}`);
    if (!currentSentence?.id) return;

    try {
      /**
       * 服务端文件：server/src/routes/perfect-recordings.ts
       * 接口：GET /api/v1/perfect-recordings/public/:sentenceId
       * Query 参数：limit?: number, excludeUserId?: string
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/public/${currentSentence.id}?limit=5&excludeUserId=${user?.id || ''}`
      );
      const data = await response.json();

      console.log(`[fetchPublicRecordings] 获取结果: ${JSON.stringify(data)}`);
      if (data.success) {
        setPublicRecordings(data.data || []);
        console.log(`[fetchPublicRecordings] 设置了 ${data.data?.length || 0} 条记录`);
      }
    } catch (error) {
      console.error('获取公开分享发音失败:', error);
    }
  }, [currentSentence?.id, user?.id]);

  // 保存学习进度
  const saveProgress = useCallback(async (sentenceIndex: number) => {
    // 课程模式使用 lessonId，句库模式使用 fileId
    const recordId = sourceType === 'lesson' ? lessonId : fileId;
    if (!recordId) return;
    
    // 【修复】无论是否登录，都保存到本地缓存
    if (sentences.length > 0) {
      await saveLocalProgress(sourceType, recordId, {
        sentenceIndex: sentenceIndex,
        totalSentences: sentences.length,
        updatedAt: Date.now(),
        completed: false,
      });
      console.log(`[本地进度] 已保存: 第 ${sentenceIndex + 1} 句 (ID: ${recordId})`);
    }
    
    // 登录用户同时保存到服务端
    if (!isAuthenticated || !user?.id) return;
    
    try {
      /**
       * 服务端文件：server/src/routes/learning.ts
       * 接口：POST /api/v1/learning-records/progress/:fileId
       * Body 参数：user_id: string, sentence_index: number
       */
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/progress/${recordId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sentence_index: sentenceIndex,
        }),
      });
      console.log(`[服务端进度] 已保存: 第 ${sentenceIndex + 1} 句 (ID: ${recordId})`);
    } catch (error) {
      console.error('[服务端进度] 保存失败:', error);
    }
  }, [fileId, lessonId, sourceType, isAuthenticated, user?.id, sentences.length]);

  // 同步 ref 值（用于 cleanup 中获取最新值）
  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    resumingFromProgressRef.current = resumingFromProgress;
  }, [resumingFromProgress]);

  // 每次页面获得焦点时重新加载语音答题模式配置
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      isExitingRef.current = false; // 重置退出标记
      hasShownProgressAlert.current = false; // 重置进度弹窗标记，允许每次进入时检查进度
      
      // 开始学习计时（进入页面就开始计时）
      sessionStartTimeRef.current = Date.now();
      lastActivityTimeRef.current = Date.now();
      accumulatedDurationRef.current = 0;
      console.log('[学习时长] 开始计时');
      
      // 重新加载语音答题模式配置（用户可能在设置页面修改了）
      (async () => {
        const mode = await getVoicePracticeMode();
        if (mode !== voicePracticeModeRef.current) {
          console.log('[语音答题模式] 检测到模式变化:', voicePracticeModeRef.current, '->', mode);
          setVoicePracticeMode(mode);
          voicePracticeModeRef.current = mode;
        }
      })();
      
      fetchSentences();
      fetchNextLesson(); // 课程模式：获取下一课时信息
      // 注意：fetchPerfectRecordings 在 useEffect 中根据 currentSentence?.id 变化时调用

      return () => {
        isMountedRef.current = false;
        stopPlayback();
        
        // 清理预览音频播放器
        if (previewSoundRef.current) {
          previewSoundRef.current.unloadAsync().catch(() => {});
          previewSoundRef.current = null;
        }
        
        // 清理录音对象
        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
        }
        
        // 清理录音计时器
        if (recordingTimerRef.current) {
          clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // 重置音频模式（释放录音资源）
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,  // 强制使用扬声器
        }).catch(() => {});
        
        // 使用 ref 获取最新值（避免闭包陷阱）
        const latestSentences = sentencesRef.current;
        const latestIndex = currentIndexRef.current;
        
        // 提交学习时长（退出页面时，使用有效时长）
        if (sessionStartTimeRef.current && user?.id) {
          const duration = Math.round(calculateEffectiveDuration());
          if (duration > 0) {
            // 异步提交学习时长，不等待
            fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/daily`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: user.id,
                score: 0,
                duration_seconds: duration,
                sentences_completed: 0,
              }),
            }).catch(e => console.error('[学习时长] 提交失败:', e));
            console.log(`[学习时长] 已提交有效时长: ${duration}秒`);
          }
        }
        
        // 如果用户还没有通过 BackHandler 处理退出（比如 Web 端），这里保存进度
        // 注意：这个 cleanup 会在 BackHandler 的回调之后执行
        // 只要有句子数据就保存学习位置（即使只学了第一句也要保存）
        if (!isExitingRef.current && latestSentences.length > 0) {
          // 保存进度（不提交学习时长，因为用户可能是意外退出）
          saveProgress(latestIndex);
          console.log(`[学习进度] 退出时自动保存: 第 ${latestIndex + 1} 句`);
          
          // 保存学习位置（用于首页"继续学习"快捷入口）
          const position: LastLearningPosition = {
            sourceType: sourceType === 'lesson' ? 'lesson' : 'sentence_file',
            sentenceIndex: latestIndex,
            totalSentences: latestSentences.length,
            updatedAt: Date.now(),
          };
          
          if (sourceType === 'lesson' && lessonId && courseId) {
            position.courseId = parseInt(courseId, 10);
            position.courseTitle = courseTitle || '';
            position.lessonId = parseInt(lessonId, 10);
            position.lessonNumber = lessonNumber ? parseInt(lessonNumber, 10) : 1;
            position.lessonTitle = practiceTitle;
            position.voiceId = voiceId;
          } else if (fileId) {
            position.fileId = fileId;
            position.fileTitle = practiceTitle;
          }
          
          saveLastLearningPosition(position);
          console.log('[学习位置] 已保存:', position);
        }
      };
    }, [fetchSentences, fetchNextLesson, saveProgress, sourceType, lessonId, courseId, courseTitle, lessonNumber, practiceTitle, voiceId, fileId, user?.id, calculateEffectiveDuration])
  );

  // 追踪用户是否有学习进度变化（用于退出时提示保存）
  useEffect(() => {
    // 如果初始索引已记录，且当前索引与初始索引不同，说明有进度变化
    if (initialIndexRef.current !== null && currentIndex !== initialIndexRef.current) {
      if (!hasProgressToSave) {
        setHasProgressToSave(true);
        console.log(`[进度追踪] 检测到进度变化: ${initialIndexRef.current} -> ${currentIndex}`);
      }
    }
  }, [currentIndex, hasProgressToSave]);

  // 处理返回键/退出 - 注意：这个函数在 submitLearningData 之后定义
  // 所以 BackHandler 的 useEffect 需要在那些函数定义之后

  // 提取单词和标点
  const extractWords = useCallback((text: string) => {
    const result: { word: string; displayText: string; isPunctuation: boolean }[] = [];
    
    // 【终极修复】先将所有类型的单引号统一为标准 ASCII 单引号 (U+0027)
    // 这样 don't, what's 等缩写词才能被正确识别为一个单词
    // 使用 Unicode 码点确保匹配所有引号变体
    let normalizedText = text
      // 所有类型的单引号 → 标准单引号
      // U+2018('), U+2019('), U+201A(‚), U+201B(‛), U+2032(′), U+2035(‵)
      // U+02B9(ʹ), U+02BB(ʻ), U+02BC(ʼ), U+02BD(ʽ), U+FF07(＇), U+0060(`), U+00B4(´)
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u02B9\u02BB\u02BC\u02BD\uFF07\u0060\u00B4]/g, "'")
      // 所有类型的双引号 → 标准双引号
      // U+201C("), U+201D("), U+201E(„), U+2033(″), U+2036(‶)
      .replace(/[\u201C\u201D\u201E\u2033\u2036]/g, '"')
      // 破折号统一
      .replace(/[—–−]/g, '-');
    
    // 处理成对引号：识别独立的引号（成对出现的引号），将它们标记为直接显示
    // 使用特殊占位符标记独立引号，避免被当作单词的一部分
    // 左单引号占位符：\u2774（❴），右单引号占位符：\u2775（❵）
    // 左双引号占位符：\u2772（❲），右双引号占位符：\u2773（❳）
    
    // 处理单引号对
    let inSingleQuote = false;
    let processedText = '';
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];
      const prevChar = i > 0 ? normalizedText[i - 1] : ' ';
      const nextChar = i < normalizedText.length - 1 ? normalizedText[i + 1] : ' ';
      
      if (char === "'") {
        // 判断是否为独立引号：
        // 左引号：后面是字母或空格，前面是空格或标点
        // 右引号：前面是字母或空格，后面是空格或标点
        const isLeftQuote = /[a-zA-Z\s]/.test(nextChar) && /[\s.,!?;:()\]]/.test(prevChar);
        const isRightQuote = /[a-zA-Z\s]/.test(prevChar) && /[\s.,!?;:()\[]/.test(nextChar);
        
        if (isLeftQuote && !inSingleQuote) {
          // 开始一个单引号对，标记为独立引号
          processedText += '\u2774'; // ❴ 左单引号占位符
          inSingleQuote = true;
        } else if (isRightQuote && inSingleQuote) {
          // 结束一个单引号对
          processedText += '\u2775'; // ❵ 右单引号占位符
          inSingleQuote = false;
        } else {
          // 不是独立引号，保留原字符（单词内部的引号）
          processedText += char;
        }
      } else {
        processedText += char;
      }
    }
    
    // 处理双引号对（类似逻辑）
    let inDoubleQuote = false;
    normalizedText = processedText;
    processedText = '';
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];
      const prevChar = i > 0 ? normalizedText[i - 1] : ' ';
      const nextChar = i < normalizedText.length - 1 ? normalizedText[i + 1] : ' ';
      
      if (char === '"') {
        const isLeftQuote = /[a-zA-Z\s]/.test(nextChar) && /[\s.,!?;:()\]]/.test(prevChar);
        const isRightQuote = /[a-zA-Z\s]/.test(prevChar) && /[\s.,!?;:()\[]/.test(nextChar);
        
        if (isLeftQuote && !inDoubleQuote) {
          processedText += '\u2772'; // ❲ 左双引号占位符
          inDoubleQuote = true;
        } else if (isRightQuote && inDoubleQuote) {
          processedText += '\u2773'; // ❳ 右双引号占位符
          inDoubleQuote = false;
        } else {
          processedText += char;
        }
      } else {
        processedText += char;
      }
    }
    
    // 使用正则分割：保留单词（包括内部的 - ' &）、纯标点符号、以及独立引号占位符
    // 注意：\u2772-\u2775 需要单独列出，因为正则范围可能无法正确匹配 Unicode
    const tokens = processedText.match(/[a-z0-9'\-&]+|[,.!?;:()"❲❳❴❵]/gi) || [];

    tokens.forEach((token) => {
      // 还原独立引号占位符为显示文本
      let displayText = token;
      let isPunctuation = false;
      
      if (token === '\u2774') {
        displayText = "'"; // 左单引号
        isPunctuation = true;
      } else if (token === '\u2775') {
        displayText = "'"; // 右单引号
        isPunctuation = true;
      } else if (token === '\u2772') {
        displayText = '"'; // 左双引号
        isPunctuation = true;
      } else if (token === '\u2773') {
        displayText = '"'; // 右双引号
        isPunctuation = true;
      } else {
        // 判断是否为纯标点符号（不包含字母数字、-'&）
        isPunctuation = !/[a-z0-9]/i.test(token);
      }
      
      result.push({
        word: isPunctuation ? '' : token.toLowerCase(),
        displayText: displayText,
        isPunctuation: isPunctuation,
      });
    });

    return result;
  }, []);

  // 获取当前要播放的音源对应的voiceId
  const getCurrentPlayingVoiceId = useCallback((): string | null => {
    const sources = selectedSourceIdsRef.current;
    const index = currentPlayingSourceIndexRef.current;
    
    if (sources.length === 0) {
      return voiceId || null; // 没有选中音源，使用默认voiceId
    }
    
    // 获取当前播放索引对应的音源ID
    const currentSourceId = sources[index % sources.length];
    
    // 如果是AI音色，返回对应的voiceId
    const aiVoice = aiVoicesRef.current.find(v => v.id === currentSourceId);
    if (aiVoice) {
      return aiVoice.voiceId;
    }
    
    // 其他音源类型（用户录音、社区分享）暂时返回null，需要单独处理
    return null;
  }, [voiceId]);

  // 播放下一个音源（在播放完成后的回调中调用）
  const playNextSourceRef = useRef<(() => void) | null>(null);
  
  // 播放下一个音源的实际实现
  const playNextSource = useCallback(async () => {
    const sources = selectedSourceIdsRef.current;
    const currentIndex = currentPlayingSourceIndexRef.current;
    
    console.log(`[playNextSource] 开始执行, 音源数量: ${sources.length}, 当前索引: ${currentIndex}`);
    
    if (sources.length === 0) {
      console.log(`[playNextSource] 没有选中的音源，退出`);
      return;
    }
    
    // 计算下一个索引
    const nextIndex = (currentIndex + 1) % sources.length;
    
    // 如果已经循环完一轮，检查是否需要继续循环
    if (nextIndex === 0 && !isLoopingRef.current) {
      console.log('[多音源播放] 已播放完所有音源，停止播放');
      return;
    }
    
    // 更新索引
    currentPlayingSourceIndexRef.current = nextIndex;
    setCurrentPlayingSourceIndex(nextIndex);
    
    console.log(`[多音源播放] 播放下一个音源，索引: ${nextIndex}, 音源ID: ${sources[nextIndex]}`);
    
    // 等待一小段时间后播放下一个
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 获取下一个音源的 voiceId
    const nextSourceId = sources[nextIndex];
    const aiVoice = aiVoicesRef.current.find(v => v.id === nextSourceId);
    
    if (!aiVoice) {
      console.log('[多音源播放] 非AI音色，暂不支持');
      return;
    }
    
    // 释放之前的音频
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        // ignore
      }
    }
    
    // 尝试从本地获取音频
    const audioKey = generateCourseAudioKey(
      parseInt(courseId!, 10),
      parseInt(lessonId!, 10),
      currentSentence!.sentence_index,
      aiVoice.voiceId
    );
    const localAudioUri = await getAudioFromLocal(audioKey);
    
    // 播放完成后的回调
    const onPlaybackComplete = (status: any) => {
      if (status.isLoaded) {
        if (status.didJustFinish) {
          setIsPlaying(false);
          // 播放下一个音源
          if (isMountedRef.current && playNextSourceRef.current) {
            playNextSourceRef.current();
          }
        }
      } else if (status.error) {
        console.error('[播放错误]', status.error);
        setIsPlaying(false);
      }
    };
    
    if (localAudioUri) {
      // 有本地缓存，播放本地音频
      console.log(`[playNextSource] 播放本地音频: ${audioKey}`);
      const { sound } = await Audio.Sound.createAsync(
        { uri: localAudioUri },
        {
          shouldPlay: true,
          isLooping: false,
          volume: volumeRef.current,
          rate: playbackRateRef.current,
          shouldCorrectPitch: true,
        },
        onPlaybackComplete
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } else {
      // 无本地缓存，使用在线 TTS（支持 Web 端）
      console.log(`[playNextSource] 使用在线TTS, voiceId: ${aiVoice.voiceId}`);
      const ttsUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tts?text=${encodeURIComponent(currentSentence!.text)}&speaker=${aiVoice.voiceId}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: ttsUrl },
        {
          shouldPlay: true,
          isLooping: false,
          volume: volumeRef.current,
          rate: playbackRateRef.current,
          shouldCorrectPitch: true,
        },
        onPlaybackComplete
      );
      soundRef.current = sound;
      setIsPlaying(true);
    }
  }, [courseId, lessonId, currentSentence]);
  
  // 更新 ref
  useEffect(() => {
    playNextSourceRef.current = playNextSource;
  }, [playNextSource]);

  // 播放音频片段
  const playAudio = useCallback(async () => {
    // 课程模式：从本地存储读取音频
    if (file?.is_lesson && courseId && lessonId && currentSentence) {
      try {
        if (soundRef.current && isPlaying) {
          return;
        }

        if (soundRef.current && !isPlaying) {
          try {
            await soundRef.current.playAsync();
            setIsPlaying(true);
          } catch (e) {
            console.log('[playAudio] 恢复播放失败:', e);
          }
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
        });

        // 根据选中的音源列表，获取当前要播放的voiceId
        const playingVoiceId = getCurrentPlayingVoiceId() || voiceId;
        
        // 生成音频存储 key（包含 voiceId 以区分不同音色）
        const audioKey = generateCourseAudioKey(
          parseInt(courseId, 10),
          parseInt(lessonId, 10),
          currentSentence.sentence_index,
          playingVoiceId  // 使用当前播放的voiceId
        );
        const localAudioUri = await getAudioFromLocal(audioKey);
        
        // 播放完成后的处理：切换到下一个音源或循环播放
        // 注意：不在此处调用playAudio以避免循环引用
        
        if (localAudioUri) {
          // 有本地缓存，播放本地音频
          console.log(`[playAudio-课程] 播放本地音频: ${audioKey}, voiceId: ${playingVoiceId}`);
          const { sound } = await Audio.Sound.createAsync(
            { uri: localAudioUri },
            {
              shouldPlay: true,
              isLooping: false,
              volume: volumeRef.current,
              rate: playbackRateRef.current,
              shouldCorrectPitch: true,
            },
            (status) => {
              if (status.isLoaded) {
                if (status.didJustFinish) {
                  setIsPlaying(false);
                  // 检查是否有多个选中的音源
                  const sources = selectedSourceIdsRef.current;
                  console.log(`[播放完成] 选中的音源数量: ${sources.length}, 音源列表: ${JSON.stringify(sources)}`);
                  if (sources.length > 1 && isMountedRef.current && playNextSourceRef.current) {
                    // 多音源模式：播放下一个音源
                    console.log(`[多音源播放-本地] 当前音源播放完成，准备播放下一个`);
                    playNextSourceRef.current();
                  } else if (isLoopingRef.current && isMountedRef.current) {
                    // 单音源循环播放
                    console.log(`[单音源循环] 开始循环播放`);
                    setTimeout(async () => {
                      try {
                        await soundRef.current?.replayAsync();
                        setIsPlaying(true);
                      } catch (e) {
                        console.log('[循环播放] 失败:', e);
                      }
                    }, 500);
                  }
                }
              } else if (status.error) {
                console.error('[播放错误]', status.error);
                setIsPlaying(false);
              }
            }
          );
          soundRef.current = sound;
          setIsPlaying(true);
          return;
        }
        
        // 无本地缓存，使用在线 TTS
        console.log(`[playAudio-课程] 无本地缓存，使用在线TTS, voiceId: ${playingVoiceId}`);
        try {
          /**
           * 服务端文件：server/src/routes/tts.ts
           * 接口：GET /api/v1/tts
           * Query 参数：text: string, speaker?: string
           */
          const ttsUrl = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tts?text=${encodeURIComponent(currentSentence.text)}&speaker=${playingVoiceId}`;
          
          const { sound } = await Audio.Sound.createAsync(
            { uri: ttsUrl },
            {
              shouldPlay: true,
              isLooping: false,
              volume: volumeRef.current,
              rate: playbackRateRef.current,
              shouldCorrectPitch: true,
            },
            (status) => {
              if (status.isLoaded) {
                if (status.didJustFinish) {
                  setIsPlaying(false);
                  // 检查是否有多个选中的音源
                  const sources = selectedSourceIdsRef.current;
                  console.log(`[播放完成-TTS] 选中的音源数量: ${sources.length}, 音源列表: ${JSON.stringify(sources)}`);
                  if (sources.length > 1 && isMountedRef.current && playNextSourceRef.current) {
                    // 多音源模式：播放下一个音源
                    console.log(`[多音源播放-TTS] 当前音源播放完成，准备播放下一个`);
                    playNextSourceRef.current();
                  } else if (isLoopingRef.current && isMountedRef.current) {
                    // 单音源循环播放
                    console.log(`[单音源循环-TTS] 开始循环播放`);
                    setTimeout(async () => {
                      try {
                        await soundRef.current?.replayAsync();
                        setIsPlaying(true);
                      } catch (e) {
                        console.log('[循环播放] 失败:', e);
                      }
                    }, 500);
                  }
                }
              } else if (status.error) {
                console.error('[播放错误]', status.error);
                setIsPlaying(false);
              }
            }
          );
          soundRef.current = sound;
          setIsPlaying(true);
        } catch (ttsError) {
          console.error('[playAudio-课程] 在线TTS失败:', ttsError);
          Alert.alert('提示', '音频播放失败，请检查网络连接');
        }
        return;
      } catch (error) {
        console.error('[播放] 失败:', error);
      }
    }

    // 句库模式：从整体音频中切分播放
    if (!currentSentence || !file?.original_audio_signed_url) {
      console.log('[playAudio] 缺少音频或句子');
      return;
    }

    try {
      if (soundRef.current && isPlaying) {
        return;
      }

      if (soundRef.current && !isPlaying) {
        try {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        } catch (e) {
          console.log('[playAudio] 恢复播放失败:', e);
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });

      // 时间转换为毫秒
      const startMs = currentSentence.start_time * 1000;
      const endMs = currentSentence.end_time * 1000;
      
      // 提前 30ms 停止，确保不会播放超出时间轴的内容
      const stopThreshold = endMs - 30;

      console.log(`[playAudio] 播放片段: ${startMs}ms - ${endMs}ms (停止阈值: ${stopThreshold}ms)`);

      const { sound } = await Audio.Sound.createAsync(
        { uri: file.original_audio_signed_url },
        {
          shouldPlay: false, // 先不播放，设置位置后再播放
          isLooping: false,
          volume: volumeRef.current,
          rate: playbackRateRef.current,
          shouldCorrectPitch: true,
        },
        (status) => {
          if (status.isLoaded) {
            // 检查是否到达结束时间（使用提前阈值）
            if (status.positionMillis >= stopThreshold) {
              sound.pauseAsync().catch(() => void 0);
              setIsPlaying(false);

              // 循环播放
              if (isLoopingRef.current && isMountedRef.current) {
                setTimeout(() => {
                  if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                    soundRef.current.setPositionAsync(startMs).catch(() => void 0);
                    soundRef.current.playAsync().catch(() => void 0);
                    setIsPlaying(true);
                  }
                }, 500);
              }
            }

            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          } else if (status.error) {
            console.error('[播放错误]', status.error);
            setIsPlaying(false);
          }
        }
      );

      soundRef.current = sound;
      
      // 设置起始位置后再播放
      try {
        await sound.setPositionAsync(startMs);
        await sound.playAsync();
        setIsPlaying(true);
      } catch (seekError) {
        console.log('[playAudio] Seeking 失败:', seekError);
        // 尝试直接播放
        try {
          await sound.playAsync();
          setIsPlaying(true);
        } catch (playError) {
          console.log('[playAudio] 播放失败:', playError);
        }
      }

      // 监听播放位置
      const checkInterval = setInterval(async () => {
        if (!soundRef.current) {
          clearInterval(checkInterval);
          return;
        }
        try {
          const s = await soundRef.current.getStatusAsync();
          if (s.isLoaded && s.positionMillis >= stopThreshold) {
            await sound.pauseAsync().catch(() => void 0);
            setIsPlaying(false);
            clearInterval(checkInterval);

            // 循环播放
            if (isLoopingRef.current && isMountedRef.current) {
              setTimeout(() => {
                if (isLoopingRef.current && isMountedRef.current && soundRef.current) {
                  soundRef.current.setPositionAsync(startMs).catch(() => void 0);
                  soundRef.current.playAsync().catch(() => void 0);
                  setIsPlaying(true);
                }
              }, 500);
            }
          }
        } catch (e) {
          clearInterval(checkInterval);
        }
      }, 30); // 缩短检查间隔到 30ms

    } catch (error) {
      console.error('[播放] 失败:', error);
    }
  }, [currentSentence, file, isPlaying]);

  // 更新音量
  const updateVolume = useCallback(async (newVolume: number) => {
    volumeRef.current = newVolume;
    setVolume(newVolume);
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(newVolume);
    }
  }, []);

  // 更新语速
  const updatePlaybackRate = useCallback(async (newRate: number) => {
    playbackRateRef.current = newRate;
    setPlaybackRate(newRate);
    if (soundRef.current) {
      await soundRef.current.setRateAsync(newRate, true);
    }
  }, []);

  // 暂停播放
  const pauseAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } catch (e) {
        console.error('暂停失败:', e);
      }
    }
  }, []);

  // 停止播放
  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // 切换播放/暂停
  const togglePlayPause = useCallback(() => {
    // 记录用户活动（播放/暂停音频）
    recordActivity();
    
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, playAudio, pauseAudio, recordActivity]);

  // 初始化当前句子
  useEffect(() => {
    if (!currentSentence) return;

    stopPlayback();

    // 重置句子积分
    currentSentencePointsRef.current = 0;

    // 重置完美发音跟踪状态
    sentenceStartedWithVoiceRef.current = false;
    sentenceHadTypingRef.current = false;
    sentenceHadVoiceErrorRef.current = false;
    sentenceUsedHintRef.current = false;
    lastRecordingUriRef.current = null;

    const tokens = extractWords(currentSentence.text);
    const newWordStatuses = tokens.map((token, index) => ({
      word: token.word,
      displayText: token.displayText,
      revealed: token.isPunctuation,
      revealedChars: token.isPunctuation ? [] : new Array(token.word.length).fill(false),
      errorCharIndex: -1,
      index,
      isPunctuation: token.isPunctuation,
    }));
    setWordStatuses(newWordStatuses);
    setCurrentInput('');
    setTargetWordIndex(null); // 重置目标单词
    isLoopingRef.current = true;
    setIsLooping(true);

    // 预加载所有单词的翻译
    const wordsToTranslate = newWordStatuses
      .filter(ws => !ws.isPunctuation && !wordTranslations[ws.word])
      .map(ws => ws.word);
    
    if (wordsToTranslate.length > 0) {
      // 批量获取翻译
      Promise.all(
        wordsToTranslate.map(word => 
          fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: word, type: 'word' }),
          })
            .then(res => res.json())
            .then(data => ({ word, translation: data.translation || '' }))
            .catch(() => ({ word, translation: '' }))
        )
      ).then(results => {
        const newTranslations: Record<string, string> = {};
        results.forEach(({ word, translation }) => {
          if (translation) {
            newTranslations[word] = translation;
          }
        });
        if (Object.keys(newTranslations).length > 0) {
          setWordTranslations(prev => ({ ...prev, ...newTranslations }));
        }
      });
    }

    // 进度恢复过程中不自动播放（等待用户选择后再播放）
    // 使用 ref 检查最新状态，避免将 resumingFromProgress 加入依赖数组
    const timer = setTimeout(() => {
      // 检查是否正在恢复进度（弹窗等待用户选择）
      if (resumingFromProgressRef.current) {
        console.log('[自动播放] 跳过：正在恢复进度，等待用户选择');
        return;
      }
      playAudio();
    }, 500);

    // 获取当前句子的完美发音记录
    fetchPerfectRecordings();
    // 获取其他用户分享的发音
    fetchPublicRecordings();

    return () => {
      clearTimeout(timer);
      stopPlayback();
    };
    // 注意：playAudio、stopPlayback、fetchPerfectRecordings、fetchPublicRecordings 不要加入依赖数组
    // fetchPerfectRecordings 依赖 currentSentence?.id，会导致循环
  }, [currentSentence?.id]);

  // 显示错误闪烁效果
  const showErrorFlash = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.timing(errorAnimRef.current, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }),
      RNAnimated.timing(errorAnimRef.current, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 处理输入变化 - 使用 ref 存储最新的 wordStatuses，避免闭包问题
  const wordStatusesRef = useRef(wordStatuses);
  const targetWordIndexRef = useRef(targetWordIndex);
  
  // 初始化 ref（仅在首次渲染时）
  useEffect(() => {
    wordStatusesRef.current = wordStatuses;
  }, [wordStatuses]);
  
  useEffect(() => {
    targetWordIndexRef.current = targetWordIndex;
  }, [targetWordIndex]);

  // 辅助函数：同步更新状态和 ref
  const updateWordStatusesWithRef = useCallback((updater: (prev: WordStatus[]) => WordStatus[]) => {
    setWordStatuses(prev => {
      const next = updater(prev);
      wordStatusesRef.current = next; // 立即同步 ref
      return next;
    });
  }, []);

  const setTargetWordIndexWithRef = useCallback((value: number | null) => {
    setTargetWordIndex(value);
    targetWordIndexRef.current = value; // 立即同步 ref
  }, []);

  // 减少错题次数（错题练习模式下调用）
  const reduceErrorCount = useCallback(async (word: string) => {
    if (!isAuthenticated || !user?.id || !fileId || !errorPriority || !currentSentence) return;
    
    try {
      /**
       * 服务端文件：server/src/routes/error-words.ts
       * 接口：POST /api/v1/error-words/reduce
       * Body 参数：user_id: string, sentence_file_id: number, sentence_index: number, word: string
       */
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words/reduce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sentence_file_id: fileId,
          sentence_index: currentSentence.sentence_index, // 使用句子的原始索引
          word: word.toLowerCase(),
        }),
      });
      console.log(`[错题练习] 已减少 "${word}" 的错误次数`);
    } catch (error) {
      console.error('[错题练习] 减少错误次数失败:', error);
    }
  }, [isAuthenticated, user?.id, fileId, errorPriority, currentSentence]);

  // 记录积分
  // 记录积分（单词正确时只累积，不更新统计）
  const pendingScoreRef = useRef<number>(0); // 待提交的积分
  const pendingWordsRef = useRef<Set<string>>(new Set()); // 待减少错题次数的单词

  const recordScore = useCallback((score: number) => {
    // 只累积积分，不立即提交
    pendingScoreRef.current += score;
  }, []);

  // 提交学习数据（句子完成时调用）
  const submitLearningData = useCallback(async (sentenceCompleted: boolean, durationSeconds?: number) => {
    if (!isAuthenticated || !user?.id) return;
    
    const score = pendingScoreRef.current;
    const duration = durationSeconds || 0;
    
    // 课程模式使用 lessonId，句库模式使用 fileId
    const recordId = sourceType === 'lesson' ? lessonId : fileId;
    
    // 如果没有有效的记录ID，仍然需要更新每日统计
    // 对于课程模式，使用固定的标识符
    const effectiveId = recordId || (sourceType === 'lesson' ? `lesson_${lessonId}` : undefined);
    
    try {
      // 如果有有效的ID，保存到 file_learning_summary 表
      if (effectiveId) {
        /**
         * 服务端文件：server/src/routes/learning.ts
         * 接口：POST /api/v1/learning-records/progress/:fileId
         * Body 参数：user_id: string, sentence_index: number, score: number, duration_seconds: number, sentence_completed: boolean
         */
        await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/learning-records/progress/${effectiveId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            sentence_index: currentIndex,
            score: score,
            duration_seconds: duration,
            sentence_completed: sentenceCompleted,
          }),
        });
      }
      
      // 无论是否有ID，都直接更新每日统计
      /**
       * 服务端文件：server/src/routes/stats.ts
       * 接口：POST /api/v1/stats/daily
       * Body 参数：user_id: string, score: number, duration_seconds: number, sentences_completed: number
       */
      await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/stats/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          score: score,
          duration_seconds: duration,
          sentences_completed: sentenceCompleted ? 1 : 0,
        }),
      });
      
      console.log(`[学习数据] 已提交: 积分=${score}, 时长=${duration}秒, 句子完成=${sentenceCompleted}`);
      
      // 重置待提交数据
      pendingScoreRef.current = 0;
    } catch (error) {
      console.error('[学习数据] 提交失败:', error);
    }
  }, [isAuthenticated, user?.id, fileId, lessonId, sourceType, currentIndex]);

  // 处理单词正确输入（统一处理减少错题次数和记录积分）
  const handleWordCorrect = useCallback((word: string) => {
    // 错题练习模式：减少错题次数 + 记录1.5积分
    // 普通模式：记录1积分
    const score = errorPriority ? 1.5 : 1;
    
    // 累积当前句子积分
    currentSentencePointsRef.current += score;
    
    // 记录积分（只累积，不提交）
    recordScore(score);
    
    // 记录需要减少错题次数的单词
    pendingWordsRef.current.add(word.toLowerCase());
    
    // 减少错题次数（立即执行，不影响统计）
    reduceErrorCount(word);
    
    // 薄弱词汇练习：追踪目标单词的正确次数
    if (targetWord && word.toLowerCase() === targetWord) {
      targetWordCorrectRef.current += 1;
      console.log(`[薄弱词汇练习] "${word}" 正确次数: ${targetWordCorrectRef.current}/${targetCorrectCount}`);
      
      // 检查是否达到目标，设置标记等句子完成后返回
      if (targetWordCorrectRef.current >= targetCorrectCount) {
        console.log(`[薄弱词汇练习] 目标单词 "${word}" 已完成，句子完成后自动返回`);
        shouldReturnAfterSentenceRef.current = true;
      }
    }
  }, [errorPriority, reduceErrorCount, recordScore, targetWord, targetCorrectCount]);

  // 保存完美发音记录
  const savePerfectRecording = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !currentSentence || !lastRecordingUriRef.current) {
      return;
    }

    try {
      // 上传录音文件
      const fileData = await createFormDataFile(lastRecordingUriRef.current, `perfect_${currentSentence.id}.m4a`, 'audio/m4a');
      const uploadFormData = new FormData();
      uploadFormData.append('file', fileData as any);
      uploadFormData.append('folder', 'perfect-recordings');

      const uploadResponse = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/upload`, {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.key) {
        console.error('上传完美发音录音失败:', uploadData);
        return;
      }

      // 保存记录到数据库
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sentenceId: currentSentence.id,
          sentenceFileId: fileId,
          sentenceText: currentSentence.text,
          audioKey: uploadData.key,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('[完美发音] 已保存:', currentSentence.text);
      }
    } catch (error) {
      console.error('保存完美发音失败:', error);
    }
  }, [isAuthenticated, user?.id, currentSentence, fileId]);

  // 检测句子完成状态
  useEffect(() => {
    if (!wordStatuses || wordStatuses.length === 0) return;

    // 检查是否所有非标点单词都已完成
    const allWordsCompleted = wordStatuses
      .filter(ws => !ws.isPunctuation)
      .every(ws => ws.revealed);

    if (allWordsCompleted && currentSentence) {
      // 句子完成，检查是否是完美发音
      if (
        sentenceStartedWithVoiceRef.current &&
        !sentenceHadTypingRef.current &&
        !sentenceHadVoiceErrorRef.current
      ) {
        console.log('[完美发音] 检测到完美发音，准备保存');
        savePerfectRecording();
      }
    }
  }, [wordStatuses, currentSentence, savePerfectRecording]);

  // 关闭音频源选择面板
  const closeAudioSourcePanel = useCallback(async () => {
    setShowAudioSourcePanel(false);
    // 停止预览播放
    if (previewSoundRef.current) {
      try {
        await previewSoundRef.current.unloadAsync();
      } catch (e) {
        // 忽略清理错误
      }
      previewSoundRef.current = null;
    }
    // 恢复循环播放
    if (wasPlayingBeforePanelRef.current) {
      playAudio();
    }
  }, [playAudio]);

  // 播放预览音频（用于面板中的试听）
  const playPreviewAudio = useCallback(async (audioUrl: string) => {
    try {
      // 停止之前的预览播放
      if (previewSoundRef.current) {
        try {
          await previewSoundRef.current.unloadAsync();
        } catch (e) {
          // 忽略清理错误
        }
        previewSoundRef.current = null;
      }
      
      // 播放新的录音
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      previewSoundRef.current = sound;
      
      // 设置播放完成后的清理回调（必须在 playAsync 之前设置）
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          previewSoundRef.current = null;
        }
      });
      
      await sound.playAsync();
    } catch (error) {
      console.error('播放预览音频失败:', error);
      // 播放失败时清理资源
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
    }
  }, []);

  // 切换收藏状态
  const toggleRecordingFavorite = useCallback(async (record: any) => {
    try {
      /**
       * 服务端文件：server/src/routes/perfect-recordings.ts
       * 接口：PUT /api/v1/perfect-recordings/:id/favorite
       * Body 参数：userId: string, isFavorite: boolean
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/${record.id}/favorite`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            isFavorite: !record.is_favorite,
          }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setPerfectRecordings(prev =>
          prev.map(r => r.id === record.id ? { ...r, is_favorite: !r.is_favorite } : r)
        );
      }
    } catch (error) {
      console.error('切换收藏失败:', error);
    }
  }, [user?.id]);

  // 切换分享状态
  const toggleRecordingShare = useCallback(async (record: any) => {
    try {
      /**
       * 服务端文件：server/src/routes/perfect-recordings.ts
       * 接口：PUT /api/v1/perfect-recordings/:id/share
       * Body 参数：userId: string, isShared: boolean
       */
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/perfect-recordings/${record.id}/share`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            isShared: !record.is_shared,
          }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setPerfectRecordings(prev =>
          prev.map(r => r.id === record.id ? { ...r, is_shared: !r.is_shared } : r)
        );
      }
    } catch (error) {
      console.error('切换分享失败:', error);
    }
  }, [user?.id]);

  // 处理返回键/退出
  const handleBackPress = useCallback((): boolean => {
    // 如果正在退出，不再处理
    if (isExitingRef.current) return true;
    
    // 使用 ref 获取最新值
    const latestSentences = sentencesRef.current;
    const latestIndex = currentIndexRef.current;
    
    // 如果有句子数据，显示保存确认弹窗
    if (hasProgressToSave && latestSentences.length > 0) {
      Alert.alert(
        '保存进度',
        '是否保存当前学习进度？',
        [
          {
            text: '不保存',
            style: 'destructive',
            onPress: () => {
              isExitingRef.current = true;
              router.back();
            },
          },
          {
            text: '保存并退出',
            onPress: async () => {
              isExitingRef.current = true;
              // 保存进度
              await saveProgress(latestIndex);
              
              // 保存学习位置（用于首页"继续学习"快捷入口）
              const position: LastLearningPosition = {
                sourceType: sourceType === 'lesson' ? 'lesson' : 'sentence_file',
                sentenceIndex: latestIndex,
                totalSentences: latestSentences.length,
                updatedAt: Date.now(),
              };
              
              if (sourceType === 'lesson' && lessonId && courseId) {
                position.courseId = parseInt(courseId, 10);
                position.courseTitle = courseTitle || '';
                position.lessonId = parseInt(lessonId, 10);
                position.lessonNumber = lessonNumber ? parseInt(lessonNumber, 10) : 1;
                position.lessonTitle = practiceTitle;
                position.voiceId = voiceId;
              } else if (fileId) {
                position.fileId = fileId;
                position.fileTitle = practiceTitle;
              }
              
              saveLastLearningPosition(position);
              console.log('[学习位置] 已保存:', position);
              
              router.back();
            },
          },
        ],
        { cancelable: true }
      );
      return true; // 阻止默认返回行为
    }
    
    // 没有进度需要保存，直接返回
    return false;
  }, [hasProgressToSave, saveProgress, router, sourceType, lessonId, courseId, courseTitle, lessonNumber, practiceTitle, voiceId, fileId]);

  // 监听返回键
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  // ==================== 自建键盘相关 ====================
  
  // 字符到按键的映射
  const charToKey: Record<string, string> = {
    'a': 'ABC', 'b': 'ABC', 'c': 'ABC',
    'd': 'DEF', 'e': 'DEF', 'f': 'DEF',
    'g': 'GHI', 'h': 'GHI', 'i': 'GHI',
    'j': 'JKL', 'k': 'JKL', 'l': 'JKL',
    'm': 'MNO', 'n': 'MNO', 'o': 'MNO',
    'p': 'PQRS', 'q': 'PQRS', 'r': 'PQRS', 's': 'PQRS',
    't': 'TUV', 'u': 'TUV', 'v': 'TUV',
    'w': 'WXYZ', 'x': 'WXYZ', 'y': 'WXYZ', 'z': 'WXYZ',
    '-': '-',
    '\'': '\'',
    '&': '&',
  };

  // 将单词转换为按键编码序列
  const wordToKeySequence = useCallback((word: string): string[] => {
    const sequence: string[] = [];
    const lowerWord = word.toLowerCase();
    
    for (const char of lowerWord) {
      // 处理引号类字符
      if (isSingleQuoteLike(char)) {
        sequence.push('\'');
      } else if (isDashLike(char)) {
        sequence.push('-');
      } else if (charToKey[char]) {
        sequence.push(charToKey[char]);
      }
    }
    
    return sequence;
  }, []);

  // 预计算所有未完成单词的按键编码
  const wordKeySequences = useMemo(() => {
    const sequences: { word: string; keySequence: string[]; index: number }[] = [];
    
    wordStatuses.forEach(ws => {
      if (!ws.isPunctuation && !ws.revealed) {
        sequences.push({
          word: ws.word,
          keySequence: wordToKeySequence(ws.word),
          index: ws.index,
        });
      }
    });
    
    return sequences;
  }, [wordStatuses, wordToKeySequence]);

  // 检测句子中是否有相似前缀的单词对（需要延迟确认）
  // 例如：i/I, to/today, a/an 等
  const hasAmbiguousPrefixes = useMemo(() => {
    if (wordKeySequences.length < 2) return false;
    
    // 检查是否存在一个单词的按键序列是另一个的前缀
    for (let i = 0; i < wordKeySequences.length; i++) {
      for (let j = i + 1; j < wordKeySequences.length; j++) {
        const seq1 = wordKeySequences[i].keySequence;
        const seq2 = wordKeySequences[j].keySequence;
        
        // 检查是否一个是另一个的前缀
        const shorter = seq1.length < seq2.length ? seq1 : seq2;
        const longer = seq1.length < seq2.length ? seq2 : seq1;
        
        if (shorter.length < longer.length) {
          const isPrefix = shorter.every((k, idx) => k === longer[idx]);
          if (isPrefix) {
            return true; // 找到相似前缀对
          }
        }
      }
    }
    return false;
  }, [wordKeySequences]);

  // 检测输入是否可能匹配更长的单词（用于手机键盘/电脑键盘）
  const hasLongerPotentialMatch = useCallback((input: string) => {
    const lowerInput = input.toLowerCase();
    return wordKeySequences.some(item => 
      item.word.toLowerCase().startsWith(lowerInput) && item.word.length > input.length
    );
  }, [wordKeySequences]);

  // 处理长串句子匹配（用于语音识别输入的完整句子）
  const handleLongTextInput = useCallback((text: string) => {
    const currentWordStatuses = wordStatusesRef.current;
    
    // 获取未完成的单词列表
    const incompleteWords = currentWordStatuses.filter(w => !w.isPunctuation && !w.revealed);
    if (incompleteWords.length === 0) return;
    
    // 按位置排序
    incompleteWords.sort((a, b) => a.index - b.index);
    
    // 【调试日志】输出未完成单词
    console.log('[长文本匹配] 输入文本:', text);
    console.log('[长文本匹配] 未完成单词:', incompleteWords.map(w => w.word));
    
    // 提取输入中的单词（去除标点，转小写）
    // 【重要】与 extractWords 和 cleanText 保持一致，保留单词内部的单引号
    const inputWords = text
      .toLowerCase()
      // 【新增】处理 extractWords 中使用的 Unicode 引号占位符
      // \u2774(❴)=左单引号, \u2775(❵)=右单引号, \u2772(❲)=左双引号, \u2773(❳)=右双引号
      .replace(/[\u2774\u2775\u2772\u2773]/g, ' ')
      // 统一所有类型的单引号为标准单引号
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u02B9\u02BB\u02BC\u02BD\uFF07\u0060\u00B4]/g, "'")
      // 移除独立引号（单词外部的引号）
      .replace(/(?<![a-z])'(?![a-z])/g, ' ')
      .replace(/[""„‶❝❞]/g, ' ') // 将双引号替换为空格
      .replace(/[—–−]/g, ' ') // 将破折号替换为空格
      .replace(/[^\w\s']/g, '') // 移除标点符号（保留字母、数字、空格、单引号）
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    // 【调试日志】输出输入单词
    console.log('[长文本匹配] 输入单词:', inputWords);
    
    if (inputWords.length === 0) return;
    
    // 记录匹配成功的单词索引
    const matchedIndices: number[] = [];
    
    // 【新增】预处理：合并连续的单字母形成可能的缩写词
    // 例如：["b", "c"] -> ["bc", "b c"] 用于匹配 "B.C."
    const expandedInputWords: string[] = [];
    const singleLetterSeq: string[] = [];
    
    for (const word of inputWords) {
      if (/^[a-z]$/i.test(word)) {
        // 单个字母，加入序列
        singleLetterSeq.push(word);
      } else {
        // 不是单字母，先处理之前积累的序列
        if (singleLetterSeq.length >= 2) {
          // 合并成缩写词
          expandedInputWords.push(singleLetterSeq.join(''));
          expandedInputWords.push(singleLetterSeq.join(' '));
        } else if (singleLetterSeq.length === 1) {
          expandedInputWords.push(singleLetterSeq[0]);
        }
        singleLetterSeq.length = 0;
        // 再添加当前单词
        expandedInputWords.push(word);
      }
    }
    // 处理末尾的序列
    if (singleLetterSeq.length >= 2) {
      expandedInputWords.push(singleLetterSeq.join(''));
      expandedInputWords.push(singleLetterSeq.join(' '));
    } else if (singleLetterSeq.length === 1) {
      expandedInputWords.push(singleLetterSeq[0]);
    }
    
    // 去重
    const finalInputWords = [...new Set([...inputWords, ...expandedInputWords])];
    
    // 【新增】合并相邻单词形成连字符组合
    // 例如：["full", "length"] -> ["full-length", "full length"] 用于匹配 "full-length"
    for (let i = 0; i < inputWords.length - 1; i++) {
      const combined = `${inputWords[i]}-${inputWords[i + 1]}`;
      const combinedSpace = `${inputWords[i]} ${inputWords[i + 1]}`;
      if (!finalInputWords.includes(combined)) {
        finalInputWords.push(combined);
      }
      if (!finalInputWords.includes(combinedSpace)) {
        finalInputWords.push(combinedSpace);
      }
    }
    
    // 【新增】三词连字符组合（如 "middle-aged man"）
    for (let i = 0; i < inputWords.length - 2; i++) {
      const combined = `${inputWords[i]}-${inputWords[i + 1]}-${inputWords[i + 2]}`;
      if (!finalInputWords.includes(combined)) {
        finalInputWords.push(combined);
      }
    }
    
    // 【新增】四词连字符组合（如 "state-of-the-art"）
    for (let i = 0; i < inputWords.length - 3; i++) {
      const combined = `${inputWords[i]}-${inputWords[i + 1]}-${inputWords[i + 2]}-${inputWords[i + 3]}`;
      if (!finalInputWords.includes(combined)) {
        finalInputWords.push(combined);
      }
    }
    
    // 【新增】五词连字符组合（如 "up-to-the-minute"）
    for (let i = 0; i < inputWords.length - 4; i++) {
      const combined = `${inputWords[i]}-${inputWords[i + 1]}-${inputWords[i + 2]}-${inputWords[i + 3]}-${inputWords[i + 4]}`;
      if (!finalInputWords.includes(combined)) {
        finalInputWords.push(combined);
      }
    }
    
    console.log('[长文本匹配] 扩展后的输入单词:', finalInputWords);
    
    // 【新增】预处理：记录哪些输入词已被使用（用于连字符单词的部分匹配）
    const usedInputIndices = new Set<number>();
    
    // 无序匹配：对于每个输入单词，尝试匹配所有未完成的单词
    // 这样可以处理用户念的单词顺序和句子顺序不一致的情况
    // 支持数字/货币/符号等变体匹配
    for (const inputWord of finalInputWords) {
      for (const targetWord of incompleteWords) {
        // 如果这个目标单词已经被匹配过，跳过
        if (matchedIndices.includes(targetWord.index)) continue;
        
        // 如果匹配成功（支持变体匹配）
        if (wordsMatchWithVariants(targetWord.word, inputWord)) {
          matchedIndices.push(targetWord.index);
          console.log(`[长文本匹配] ✓ "${inputWord}" 匹配 "${targetWord.word}"`);
          break; // 匹配成功后跳出内层循环，处理下一个输入单词
        }
      }
    }
    
    // 【新增】连字符单词拆分匹配：如果目标单词包含连字符，检查用户是否说出了所有部分
    // 例如：目标是 "state-of-the-art"，用户说了 "state", "of", "the", "art"
    for (const targetWord of incompleteWords) {
      // 如果这个目标单词已经被匹配过，跳过
      if (matchedIndices.includes(targetWord.index)) continue;
      
      // 检查目标单词是否包含连字符
      if (/[-–—]/.test(targetWord.word)) {
        const parts = splitHyphenatedWord(targetWord.word);
        if (parts.length > 1) {
          // 检查用户是否说出了所有部分
          const allPartsFound = parts.every(part => 
            inputWords.some(inputWord => 
              wordsMatchWithVariants(part, inputWord)
            )
          );
          
          if (allPartsFound) {
            matchedIndices.push(targetWord.index);
            console.log(`[长文本匹配] ✓ 连字符拆分匹配: "${targetWord.word}" -> [${parts.join(', ')}]`);
          }
        }
      }
    }
    
    // 【调试日志】输出匹配结果
    console.log('[长文本匹配] 匹配的索引:', matchedIndices);
    
    // 记录语音识别成功次数（匹配到的单词数）
    if (matchedIndices.length > 0) {
      statsRef.current.voiceSuccesses += matchedIndices.length;
    }
    
    // 标记所有匹配成功的单词
    if (matchedIndices.length > 0) {
      updateWordStatusesWithRef(prev => prev.map(ws => {
        if (matchedIndices.includes(ws.index)) {
          return {
            ...ws,
            revealed: true,
            revealedChars: new Array(ws.word.length).fill(true),
            errorCharIndex: -1,
          };
        }
        return ws;
      }));
      
      // 对每个匹配成功的单词调用 handleWordCorrect
      matchedIndices.forEach(idx => {
        const ws = incompleteWords.find(w => w.index === idx);
        if (ws) {
          handleWordCorrect(ws.word);
        }
      });
      
      console.log(`[语音匹配] 成功匹配 ${matchedIndices.length} 个单词`);
    }
  }, [updateWordStatusesWithRef, handleWordCorrect]);

  // 处理手机键盘/电脑键盘输入
  const handleInputChange = useCallback((text: string) => {
    // 标记有过打字输入
    sentenceHadTypingRef.current = true;
    
    // 记录用户活动（用于学习时长统计）
    recordActivity();
    
    const currentWordStatuses = wordStatusesRef.current;

    // 检测是否输入了空格或回车（用户确认单词）
    const lastChar = text[text.length - 1];
    const isConfirmChar = lastChar === ' ' || lastChar === '\n';
    
    // 提取实际单词内容（去掉末尾的空格/回车）
    const actualInput = isConfirmChar ? text.slice(0, -1) : text

    // 空输入时重置
    if (actualInput.length === 0) {
      setCurrentInput('');
      setTargetWordIndexWithRef(null);
      return;
    }

    // 获取未完成的单词
    const incompleteWords = currentWordStatuses.filter(w => !w.isPunctuation && !w.revealed);
    if (incompleteWords.length === 0) {
      setCurrentInput('');
      return;
    }

    // 检测是否是多单词输入（包含空格）
    const wordsInInput = actualInput.split(/\s+/).filter(w => w.length > 0);
    if (wordsInInput.length > 1) {
      // 多单词输入，使用长文本匹配逻辑
      handleLongTextInput(actualInput);
      setCurrentInput('');
      setCurrentKeySequence([]);
      setTargetWordIndexWithRef(null);
      return;
    }

    // 如果用户按了空格/回车，强制匹配当前输入
    if (isConfirmChar) {
      // 取消待确认的定时器
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      
      const matchedWord = incompleteWords.find(w => wordsMatchWithVariants(w.word, actualInput));
      
      if (matchedWord) {
        // 匹配成功，显示单词
        updateWordStatusesWithRef(prev => prev.map(ws => {
          if (ws.index === matchedWord.index) {
            return {
              ...ws,
              revealed: true,
              revealedChars: new Array(ws.word.length).fill(true),
              errorCharIndex: -1,
            };
          }
          return ws;
        }));
        // 处理单词正确（减少错题次数 + 记录积分）
        handleWordCorrect(matchedWord.word);
      }
      // 无论匹配成功与否，都清空输入框和按键序列
      setCurrentInput('');
      setCurrentKeySequence([]);
      setTargetWordIndexWithRef(null);
      return;
    }

    // 正常输入流程：检查是否完全匹配某个单词
    // 位置优先：找到第一个匹配的单词
    const matchedWord = incompleteWords
      .sort((a, b) => a.index - b.index)
      .find(w => wordsMatchWithVariants(w.word, actualInput));

    if (matchedWord) {
      // 检查是否有更长的可能匹配
      const hasLonger = hasLongerPotentialMatch(actualInput);
      
      // 只有在句子中有相似前缀且有更长匹配时才延迟确认
      if (hasAmbiguousPrefixes && hasLonger) {
        // 显示匹配的单词，但延迟确认
        setCurrentInput(actualInput);
        setTargetWordIndexWithRef(matchedWord.index);
        
        // 取消之前的定时器
        if (confirmTimerRef.current) {
          clearTimeout(confirmTimerRef.current);
        }
        
        // 延迟确认
        confirmTimerRef.current = setTimeout(() => {
          handleInputChange(actualInput + ' '); // 用空格触发确认
          confirmTimerRef.current = null;
        }, 250);
      } else {
        // 没有相似前缀或没有更长匹配，立即确认
        updateWordStatusesWithRef(prev => prev.map(ws => {
          if (ws.index === matchedWord.index) {
            return {
              ...ws,
              revealed: true,
              revealedChars: new Array(ws.word.length).fill(true),
              errorCharIndex: -1,
            };
          }
          return ws;
        }));
        // 处理单词正确（减少错题次数 + 记录积分）
        handleWordCorrect(matchedWord.word);
        setCurrentInput('');
        setCurrentKeySequence([]);
        setTargetWordIndexWithRef(null);
      }
      return;
    }

    // 输入过程中只保留用户输入
    setCurrentInput(text);
    setTargetWordIndexWithRef(null);
  }, [updateWordStatusesWithRef, setTargetWordIndexWithRef, hasAmbiguousPrefixes, hasLongerPotentialMatch, handleLongTextInput, handleWordCorrect]);

  // 当前按键序列
  const [currentKeySequence, setCurrentKeySequence] = useState<string[]>([]);

  // 处理自建键盘按键
  const handleCustomKeyPress = useCallback((key: string, keyLetters: string) => {
    if (key === '⌫') {
      // 删除时，取消待确认的定时器
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setCurrentInput(prev => prev.slice(0, -1));
      setCurrentKeySequence(prev => prev.slice(0, -1));
      return;
    }
    
    if (key === '清空') {
      // 清空时，取消待确认的定时器
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      setCurrentInput('');
      setCurrentKeySequence([]);
      setTargetWordIndexWithRef(null);
      return;
    }
    
    if (key === '空格') {
      // 空格键：立即确认当前输入
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      if (currentInput.length > 0) {
        handleInputChange(currentInput);
        setCurrentInput('');
        setCurrentKeySequence([]);
        setTargetWordIndexWithRef(null);
      }
      return;
    }
    
    // 取消之前的延迟确认定时器（用户继续输入）
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    
    // 添加按键到序列
    const pressedKey = ['-', '\'', '&'].includes(key) ? key : keyLetters;
    
    setCurrentKeySequence(prev => {
      const newSequence = [...prev, pressedKey];
      
      // 1. 找到所有匹配的单词（按键序列前缀匹配）
      const matched = wordKeySequences.filter(item => {
        const targetSeq = item.keySequence;
        if (newSequence.length > targetSeq.length) return false;
        return newSequence.every((k, i) => k === targetSeq[i]);
      });
      
      if (matched.length === 0) {
        // 没有匹配，不更新序列
        return prev;
      }
      
      // 2. 检查是否有完全匹配
      const exactMatches = matched.filter(item => item.keySequence.length === newSequence.length);
      
      // 3. 检查是否有更长的前缀匹配（说明可能有更长的单词）
      const hasLongerMatch = matched.some(item => item.keySequence.length > newSequence.length);
      
      // 4. 按位置排序：优先选择位置靠前的单词
      matched.sort((a, b) => a.index - b.index);
      
      if (exactMatches.length > 0 && !hasLongerMatch) {
        // 有完全匹配，且没有更长的前缀匹配 → 可以确认
        // 最长匹配优先：在完全匹配中选择单词最长的那个
        exactMatches.sort((a, b) => b.word.length - a.word.length);
        const word = exactMatches[0];
        setCurrentInput(word.word);
        setTargetWordIndexWithRef(word.index);
        
        // 只有在句子中有相似前缀的情况下才延迟确认
        if (hasAmbiguousPrefixes) {
          confirmTimerRef.current = setTimeout(() => {
            handleInputChange(word.word);
            setCurrentInput('');
            setCurrentKeySequence([]);
            setTargetWordIndexWithRef(null);
            confirmTimerRef.current = null;
          }, 250);
        } else {
          // 没有相似前缀，立即确认
          handleInputChange(word.word);
          setCurrentInput('');
          setCurrentKeySequence([]);
          setTargetWordIndexWithRef(null);
        }
        
        return newSequence;
      }
      
      // 有完全匹配但也有更长的前缀匹配，或者只有前缀匹配
      // 显示第一个匹配单词的前缀（按位置优先）
      const firstMatch = matched[0];
      const wordChars = firstMatch.word.slice(0, newSequence.length);
      setCurrentInput(wordChars);
      setTargetWordIndexWithRef(firstMatch.index);
      return newSequence;
    });
  }, [wordKeySequences, handleInputChange, setTargetWordIndexWithRef, currentInput, hasAmbiguousPrefixes]);

  // 检查是否完成
  useEffect(() => {
    if (wordStatuses.length === 0) return;

    const allRevealed = wordStatuses.every(w => w.isPunctuation || w.revealed);

    if (allRevealed && wordStatuses.some(w => !w.isPunctuation)) {
      handleSentenceComplete();
    }
  }, [wordStatuses]);

  // 句子完成处理
  const handleSentenceComplete = useCallback(async () => {
    isLoopingRef.current = false;
    setIsLooping(false);
    pauseAudio();
    
    // 提交学习数据（积分和句子完成标记，时长在退出页面时统一提交）
    await submitLearningData(true, 0);
    
    // 保存学习进度（当前句子已完成，准备进入下一句）
    saveProgress(currentIndex);
    
    // 【新增】同时保存到本地缓存
    const progressId = sourceType === 'lesson' ? lessonId : fileId;
    if (progressId && sentences.length > 0) {
      // 计算下一句的索引（用户即将学习的句子）
      const nextIndex = currentIndex + 1;
      const isCompleted = nextIndex >= sentences.length;
      
      await saveLocalProgress(sourceType, progressId, {
        sentenceIndex: isCompleted ? sentences.length - 1 : nextIndex, // 如果已完成，保存最后一句
        totalSentences: sentences.length,
        updatedAt: Date.now(),
        completed: isCompleted,
      });
      
      // 如果课程已完成，清除本地进度缓存
      if (isCompleted) {
        console.log('[本地进度] 课程已完成，清除缓存');
        await clearLocalProgress(sourceType, progressId);
      }
    }

    // 重置累积积分
    currentSentencePointsRef.current = 0;

    // 检查是否需要在句子完成后返回薄弱词汇页面
    if (shouldReturnAfterSentenceRef.current) {
      // 获取翻译并显示后返回
      try {
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: currentSentence?.text, type: 'sentence' }),
        });
        const data = await response.json();
        setCurrentTranslation(data.translation || '');
        setShowTranslation(true);

        setTimeout(() => {
          router.back();
        }, 2000);
      } catch (e) {
        console.error('获取翻译失败:', e);
        router.back();
      }
      return;
    }

    // 检查是否是一遍过，如果是则显示情绪价值
    const isFirstTry = !sentenceHadTypingRef.current && 
                       !sentenceHadVoiceErrorRef.current && 
                       !sentenceUsedHintRef.current;
    if (isFirstTry) {
      // 计算句子单词数量
      const wordCount = currentSentence?.text.split(/\s+/).filter(w => w.length > 0).length || 0;
      showSentencePraise(wordCount);
      // 记录首次正确
      statsRef.current.firstTryCorrect += 1;
    }

    // 获取翻译并显示
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentSentence?.text, type: 'sentence' }),
      });
      const data = await response.json();
      setCurrentTranslation(data.translation || '');
      setShowTranslation(true);

      setTimeout(() => {
        setShowTranslation(false);
        setCurrentTranslation('');
        goToNextSentence();
      }, 2000);
    } catch (e) {
      console.error('获取翻译失败:', e);
      setTimeout(() => {
        goToNextSentence();
      }, 600);
    }
  }, [currentSentence, pauseAudio, currentIndex, saveProgress, router, showSentencePraise]);

  // 处理单词点击
  const handleWordPress = useCallback((ws: WordStatus) => {
    if (ws.isPunctuation) return;
    
    // 记录用户活动（点击单词查看提示/翻译）
    recordActivity();
    
    // 设置当前显示的单词索引
    setTranslationWordIndex(ws.index);
    
    // 检查是否已有缓存
    const hasCache = wordContextMeanings[ws.word] && wordPhonetics[ws.word];
    
    if (!hasCache && currentSentence) {
      // 获取单词在句子中的意思和音标
      fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/translate/word-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          word: ws.word, 
          sentence: currentSentence.text 
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.meaning) {
            setWordContextMeanings(prev => ({
              ...prev,
              [ws.word]: data.meaning,
            }));
          }
          if (data.phonetic) {
            setWordPhonetics(prev => ({
              ...prev,
              [ws.word]: data.phonetic,
            }));
          }
        })
        .catch(e => console.error('获取单词信息失败:', e));
    }
    
    if (!ws.revealed) {
      // 未完成的单词：同时显示提示（完整单词）
      setHintWordIndex(ws.index);
      
      // 标记使用了提示
      sentenceUsedHintRef.current = true;
      
      // 记录错题：用户查看提示说明不知道这个单词
      if (isAuthenticated && user?.id && fileId && currentSentence) {
        fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/error-words`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            sentence_file_id: fileId,
            sentence_index: currentSentence.sentence_index,
            word: ws.word,
            sentence_text: currentSentence.text,
          }),
        }).catch(e => console.log('记录错题失败:', e));
      }
    }
    
    // 延迟隐藏提示
    setTimeout(() => {
      setTranslationWordIndex(null);
      setHintWordIndex(null);
    }, 2000);
    
    // 恢复输入框焦点，方便用户继续输入
    if (!ws.revealed) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [wordContextMeanings, wordPhonetics, isAuthenticated, user?.id, fileId, currentSentence, recordActivity]);

  // 跳转到上一句
  const goToPrevSentence = useCallback(() => {
    if (currentIndex > 0) {
      // 记录用户活动（切换句子）
      recordActivity();
      
      stopPlayback();
      currentSentencePointsRef.current = 0; // 重置句子积分
      // 清除语音识别结果
      setShowVoiceResult(false);
      setRecognizedWordMatches([]);
      setVoiceResultText('');
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, stopPlayback, recordActivity]);

  // 跳转到下一句
  const goToNextSentence = useCallback(() => {
    // 单句模式：直接返回上一页
    if (singleSentenceMode) {
      stopPlayback();
      router.back();
      return;
    }
    
    if (currentIndex < sentences.length - 1) {
      // 记录用户活动（切换句子）
      recordActivity();
      
      stopPlayback();
      currentSentencePointsRef.current = 0; // 重置句子积分
      // 清除语音识别结果
      setShowVoiceResult(false);
      setRecognizedWordMatches([]);
      setVoiceResultText('');
      setCurrentIndex(prev => prev + 1);
    } else {
      // 课程完成，显示庆祝弹窗
      stopPlayback();
      const duration = Math.round(calculateEffectiveDuration());
      setCompletionDuration(duration);
      
      // 计算统计数据
      const stats = statsRef.current;
      const typingAccuracy = stats.totalKeystrokes > 0 
        ? Math.round((stats.correctKeystrokes / stats.totalKeystrokes) * 100) 
        : 100;
      const firstTryRate = stats.totalSentences > 0 
        ? Math.round((stats.firstTryCorrect / stats.totalSentences) * 100) 
        : 0;
      
      setCompletionStats({
        typingAccuracy,
        voiceAttempts: stats.voiceAttempts,
        voiceSuccesses: stats.voiceSuccesses,
        hintUsedCount: stats.hintUsedCount,
        firstTryRate,
      });
      
      setShowCompletionModal(true);
      
      // 播放成功音效
      playSuccessSound();
    }
  }, [singleSentenceMode, currentIndex, sentences.length, stopPlayback, recordActivity, calculateEffectiveDuration, router]);

  // 播放成功音效（使用简短的在线音效）
  const playSuccessSound = useCallback(async () => {
    let sound: Audio.Sound | null = null;
    try {
      // 使用一个简短的成功音效
      const result = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3' },
        { volume: 0.5 }
      );
      sound = result.sound;
      
      // 设置播放完成后的清理回调（必须在 playAsync 之前设置）
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound?.unloadAsync().catch(() => {});
        }
      });
      
      await sound.playAsync();
    } catch (error) {
      // 音效播放失败不影响主流程，但要释放资源
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      console.log('[音效] 播放成功音效失败（可忽略）:', error);
    }
  }, []);

  // 处理课程完成弹窗关闭
  const handleCompletionClose = useCallback(() => {
    setShowCompletionModal(false);
    // 提交最终学习数据
    submitLearningData(true, completionDuration);
    
    // 课程模式：如果有下一课，跳转到下一课（lesson-practice 页面，可生成音频）
    if (sourceType === 'lesson' && nextLessonId) {
      console.log(`[课程学习] 跳转到下一课: 第${nextLessonNumber}课 - ${nextLessonTitle}`);
      router.replace('/lesson-practice', {
        lessonId: nextLessonId.toString(),
        title: nextLessonTitle,
        courseId: courseId,
        courseTitle: courseTitle,
        lessonNumber: nextLessonNumber.toString(),
      });
    } else {
      router.back();
    }
  }, [submitLearningData, completionDuration, router, sourceType, nextLessonId, nextLessonNumber, nextLessonTitle, courseId, courseTitle]);

  // 开始语音输入
  const startRecording = useCallback(async () => {
    if (!hasRecordingPermission) {
      Alert.alert('权限不足', '需要麦克风权限才能使用语音输入');
      isStartingRecordingRef.current = false;
      return;
    }

    // 标记正在启动录音（用于 onTouchEnd 检测）
    isStartingRecordingRef.current = true;

    // 记录用户活动（语音输入）
    recordActivity();

    // ===== 最简单可靠的方案：无条件暂停音频 =====
    // 不管是移动端（onTouchStart已处理）还是Web端，都确保音频被暂停
    if (soundRef.current) {
      try {
        // 获取当前播放状态
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          // 记录播放状态（只有还没记录时才记录，避免覆盖 onTouchStart 的记录）
          if (!wasPlayingBeforeRecordingRef.current) {
            wasPlayingBeforeRecordingRef.current = true;
            console.log('[录音开始] 记录播放状态');
          }
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          console.log('[录音开始] 音频已暂停');
        }
      } catch (e) {
        console.log('[录音开始] 暂停音频失败:', e);
      }
    }

    // 方案B（跟随朗读）：显示友好的引导提示
    if (voicePracticeModeRef.current === 'follow-along') {
      const remainingWords = wordStatusesRef.current
        .filter(ws => !ws.isPunctuation && !ws.revealed)
        .map(ws => ws.word);
      
      if (remainingWords.length > 0) {
        const displayWords = remainingWords.slice(0, 5).join(' ');
        const moreCount = remainingWords.length > 5 ? ` +${remainingWords.length - 5}` : '';
        setVoiceSentenceSuggestion(`🎧 跟着念: ${displayWords}${moreCount}`);
        setShowVoiceResult(true);
      }
    }

    try {
      // 先清理可能存在的旧录音对象
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          // 忽略清理错误
        }
        recordingRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,  // 强制使用扬声器，避免听筒播放
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setIsRecording(true);
      // 录音成功启动，清除"正在启动"标记
      isStartingRecordingRef.current = false;
      
      // 标记为语音模式开始（如果还没有打字输入）
      if (!sentenceHadTypingRef.current) {
        sentenceStartedWithVoiceRef.current = true;
      }
    } catch (error) {
      console.error('开始录音失败:', error);
      isStartingRecordingRef.current = false;
      Alert.alert('录音失败', '无法启动录音');
    }
  }, [hasRecordingPermission, recordActivity]);

  // 停止语音输入并识别
  const stopRecordingAndRecognize = useCallback(async () => {
    if (!recordingRef.current) return;

    setIsRecording(false);
    
    // 记录语音识别尝试次数
    statsRef.current.voiceAttempts += 1;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      // 保存录音URI（可能用于完美发音记录）
      if (uri) {
        lastRecordingUriRef.current = uri;
      }

      if (uri && currentSentence) {
        const fileData = await createFormDataFile(uri, 'recording.m4a', 'audio/m4a');
        const formData = new FormData();
        formData.append('file', fileData as any);
        // 传递目标句子文本，用于 ASR 混淆词修复（如 we'll → well）
        formData.append('targetText', currentSentence.text);

        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/speech-recognize`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.text) {
          const recognizedText = data.text.toLowerCase();
          const mode = voicePracticeModeRef.current;
          
          console.log(`[语音识别] 模式: ${mode}, 识别结果: ${recognizedText}`);
          
          // 获取当前未完成的单词索引
          const incompleteIndices = wordStatusesRef.current
            .map((ws, idx) => (!ws.isPunctuation && !ws.revealed) ? idx : -1)
            .filter(idx => idx !== -1);
          
          // 根据语音答题模式采用不同的处理逻辑
          if (mode === 'auto-match') {
            // ===== 方案A：自动匹配模式 =====
            // 极简风格：显示识别结果，匹配到的变绿，不要任何红色提示
            
            const { score, wordMatches, recognizedWordMatches: recMatches } = calculateMatchScore(recognizedText, currentSentence.text);
            const matchedWords = wordMatches.filter(w => w.isMatch).map(w => w.word);
            
            // 显示用户念的内容，并把匹配到的单词标绿
            setVoiceResultText(recognizedText);
            setVoiceMatchScore(score);
            setRecognizedWordMatches(recMatches); // 保存识别结果中每个词的匹配状态
            setVoiceWordMatches([]); // 不显示红色块块
            setVoiceSentenceSuggestion(''); // 不显示任何提示
            setShowVoiceResult(true);
            
            // 延迟一下再填入匹配结果，让用户先看到识别结果
            setTimeout(() => {
              if (matchedWords.length > 0) {
                handleLongTextInput(matchedWords.join(' '));
              }
              
              // 检查是否全部完成
              const newIncompleteIndices = wordStatusesRef.current
                .map((ws, idx) => (!ws.isPunctuation && !ws.revealed) ? idx : -1)
                .filter(idx => idx !== -1);
              
              if (newIncompleteIndices.length === 0) {
                // 全部完成，短暂显示后隐藏
                setTimeout(() => setShowVoiceResult(false), 1000);
              } else {
                // 还有未完成的，恢复音频播放
                setTimeout(() => {
                  if (isLoopingRef.current && isMountedRef.current) {
                    playAudio();
                  }
                }, 500);
              }
              
              // 记录是否有语音错误（用于完美发音判断）
              if (score < 100 && newIncompleteIndices.length > 0) {
                sentenceHadVoiceErrorRef.current = true;
              }
            }, 300);
            
          } else if (mode === 'follow-along') {
            // ===== 方案B：分段跟读模式 =====
            // 显示引导提示，帮助用户知道要念什么
            
            // 获取所有未完成的单词
            const incompleteWords = wordStatusesRef.current
              .filter(ws => !ws.isPunctuation && !ws.revealed)
              .map(ws => ws.word.toLowerCase());
            
            if (incompleteWords.length === 0) {
              setShowVoiceResult(false);
              return;
            }
            
            // 计算匹配度
            const { score, wordMatches, recognizedWordMatches: recMatches } = calculateMatchScore(recognizedText, currentSentence.text);
            
            // 从识别结果中匹配所有未完成的单词（不需要按顺序）
            const matchedWords = wordMatches
              .filter(w => incompleteWords.includes(w.word.toLowerCase()) && w.isMatch)
              .map(w => w.word);
            
            // 显示识别结果，匹配到的标绿
            setVoiceResultText(recognizedText);
            setVoiceMatchScore(score);
            setRecognizedWordMatches(recMatches);
            
            if (matchedWords.length > 0) {
              handleLongTextInput(matchedWords.join(' '));
            }
            
            // 获取新的剩余未完成单词
            const newIncompleteIndices = wordStatusesRef.current
              .map((ws, idx) => (!ws.isPunctuation && !ws.revealed) ? idx : -1)
              .filter(idx => idx !== -1);
            
            if (newIncompleteIndices.length > 0) {
              sentenceHadVoiceErrorRef.current = true;
              const unmatchedWords = wordMatches.filter(w => !w.isMatch);
              
              // 获取剩余的未完成单词列表
              const remainingWords = wordStatusesRef.current
                .filter(ws => !ws.isPunctuation && !ws.revealed)
                .map(ws => ws.word);
              
              setVoiceResultText(recognizedText);
              setVoiceMatchScore(score);
              setVoiceWordMatches(unmatchedWords);
              
              // 提示用户剩余的单词（最多显示5个）
              const displayWords = remainingWords.slice(0, 5).join(' ');
              const moreCount = remainingWords.length > 5 ? ` +${remainingWords.length - 5}` : '';
              setVoiceSentenceSuggestion(`继续念: ${displayWords}${moreCount}`);
              setShowVoiceResult(true);
              
              // ===== 恢复音频播放 =====
              setTimeout(() => {
                if (isLoopingRef.current && isMountedRef.current) {
                  playAudio();
                }
              }, 500);
            } else {
              setShowVoiceResult(false);
            }
          } else if (mode === 'smart-guide') {
            // ===== 方案C：智能引导模式 =====
            // 自动播放未完成部分的音频，然后等待用户跟读
            
            // 获取第一个未完成的单词
            const firstIncompleteIdx = incompleteIndices[0];
            if (firstIncompleteIdx === undefined) {
              setShowVoiceResult(false);
              return;
            }
            
            // 计算匹配度
            const { score, wordMatches, recognizedWordMatches: recMatches } = calculateMatchScore(recognizedText, currentSentence.text);
            const matchedWords = wordMatches.filter(w => w.isMatch).map(w => w.word);
            
            // 显示识别结果，匹配到的标绿
            setVoiceResultText(recognizedText);
            setVoiceMatchScore(score);
            setRecognizedWordMatches(recMatches);
            
            if (matchedWords.length > 0) {
              handleLongTextInput(matchedWords.join(' '));
            }
            
            // 获取新的剩余未完成单词
            const newIncompleteIndices = wordStatusesRef.current
              .map((ws, idx) => (!ws.isPunctuation && !ws.revealed) ? idx : -1)
              .filter(idx => idx !== -1);
            
            if (newIncompleteIndices.length > 0) {
              sentenceHadVoiceErrorRef.current = true;
              const unmatchedWords = wordMatches.filter(w => !w.isMatch);
              setVoiceWordMatches(unmatchedWords);
              setVoiceSentenceSuggestion(`听听怎么读，再跟读`);
              setShowVoiceResult(true);
              
              // 方案C特有：自动播放原音频帮助用户跟读
              setTimeout(() => {
                if (!isPlaying) {
                  playAudio();
                }
              }, 800);
            } else {
              setShowVoiceResult(false);
            }
          }
        }
        
        // 恢复音频播放模式（从听筒切回扬声器）
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            interruptionModeIOS: 1,
            shouldDuckAndroid: true,
            interruptionModeAndroid: 1,
            playThroughEarpieceAndroid: false,  // 强制使用扬声器
          });
        } catch (e) {
          // 忽略恢复错误
        }
        
        // ===== 统一恢复播放逻辑 =====
        // 如果录音前是在播放状态，且循环状态仍然开启，恢复播放
        if (wasPlayingBeforeRecordingRef.current && isLoopingRef.current && isMountedRef.current) {
          console.log('[录音结束] 恢复音频播放');
          setTimeout(() => {
            if (isLoopingRef.current && isMountedRef.current) {
              playAudio();
            }
          }, 300);
        }
        // 重置录音前播放状态
        wasPlayingBeforeRecordingRef.current = false;
      }
    } catch (error) {
      console.error('语音识别失败:', error);
      // 恢复音频播放模式
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,  // 强制使用扬声器
        });
      } catch (e) {
        // 忽略恢复错误
      }
      
      // 出错时也尝试恢复播放
      if (wasPlayingBeforeRecordingRef.current && isLoopingRef.current && isMountedRef.current) {
        console.log('[录音出错] 恢复音频播放');
        setTimeout(() => {
          if (isLoopingRef.current && isMountedRef.current) {
            playAudio();
          }
        }, 300);
      }
      wasPlayingBeforeRecordingRef.current = false;
    }
  }, [currentSentence, handleLongTextInput, playAudio, isPlaying]);

  // 清理
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  if (loading) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </ThemedView>
      </Screen>
    );
  }

  if (!file || sentences.length === 0) {
    return (
      <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
        <ThemedView level="root" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <FontAwesome6 name="file-circle-xmark" size={48} color={theme.error} />
          <ThemedText variant="body" color={theme.textPrimary} style={{ marginTop: Spacing.lg }}>
            暂无可学习的句子
          </ThemedText>
          <ThemedText variant="small" color={theme.textMuted} style={{ marginTop: Spacing.sm }}>
            请先在句库制作中编辑时间轴
          </ThemedText>
          <TouchableOpacity
            style={{ marginTop: Spacing.xl, padding: Spacing.lg, backgroundColor: theme.primary, borderRadius: BorderRadius.lg }}
            onPress={() => router.back()}
          >
            <ThemedText variant="bodyMedium" color={theme.buttonPrimaryText}>返回</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={theme.backgroundRoot} statusBarStyle={isDark ? 'light' : 'dark'}>
      {/* Header */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.header}
        onPress={() => showAudioSettings && setShowAudioSettings(false)}
      >
        <TouchableOpacity onPress={() => { stopPlayback(); router.back(); }} style={styles.backBtn}>
          <FontAwesome6 name="arrow-left" size={18} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <ThemedText variant="caption" color={theme.textMuted} numberOfLines={1}>{file.title}</ThemedText>
          <ThemedText variant="bodyMedium" color={theme.textPrimary}>
            {currentIndex + 1} / {sentences.length}
          </ThemedText>
        </View>
        {/* 右侧小控制按钮 */}
        <View style={styles.headerControls}>
          {/* 音频源选择按钮 - 点击打开音源选择面板 */}
          <TouchableOpacity
            style={[styles.smallControlBtn, showAudioSourcePanel && styles.smallControlBtnActive]}
            onPress={() => {
              if (!showAudioSourcePanel) {
                // 打开面板：暂停循环播放
                wasPlayingBeforePanelRef.current = isPlaying;
                if (isPlaying) {
                  pauseAudio();
                }
              } else {
                // 关闭面板：恢复播放
                if (wasPlayingBeforePanelRef.current) {
                  playAudio();
                }
              }
              setShowAudioSourcePanel(prev => !prev);
            }}
          >
            <FontAwesome6 name="star" size={14} color={showAudioSourcePanel ? theme.accent : theme.textMuted} />
          </TouchableOpacity>
          {/* 编辑此句按钮 */}
          <TouchableOpacity
            style={styles.smallControlBtn}
            onPress={() => {
              stopPlayback();
              // 课程模式：跳转到 lesson-practice 页面编辑
              if (sourceType === 'lesson' && lessonId && currentSentence?.id) {
                router.push('/lesson-practice', { 
                  lessonId: lessonId,
                  title: file.title,
                  editSentenceId: String(currentSentence.id),
                  returnTo: 'practice',
                });
              } else if (fileId) {
                // 句库模式：跳转到 edit-sentence-audio 页面
                router.push('/edit-sentence-audio', { 
                  fileId: fileId, 
                  sentenceIndex: currentIndex 
                });
              }
            }}
          >
            <FontAwesome6 name="pencil" size={14} color={theme.textMuted} />
          </TouchableOpacity>
          {/* 键盘切换按钮 */}
          <TouchableOpacity
            style={[styles.smallControlBtn, keyboardType === 'custom' && styles.smallControlBtnActive]}
            onPress={() => setKeyboardType(prev => prev === 'system' ? 'custom' : 'system')}
          >
            <FontAwesome6 name={keyboardType === 'custom' ? "keyboard" : "mobile-screen"} size={14} color={keyboardType === 'custom' ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallControlBtn, showAudioSettings && styles.smallControlBtnActive]}
            onPress={() => setShowAudioSettings(prev => !prev)}
          >
            <FontAwesome6 name="sliders" size={14} color={showAudioSettings ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallControlBtn, isPlaying && styles.smallControlBtnActive]}
            onPress={togglePlayPause}
          >
            <FontAwesome6 name={isPlaying ? "pause" : "play"} size={14} color={isPlaying ? theme.primary : theme.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Audio Settings Panel */}
      {showAudioSettings && (
        <View style={styles.audioSettingsPanel}>
          {/* Volume Control */}
          <View style={styles.settingRow}>
            <FontAwesome6 name="volume-low" size={14} color={theme.textMuted} style={styles.settingIcon} />
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${volume * 100}%` }]} />
                <View style={[styles.sliderThumb, { left: `${volume * 100}%` }]} />
              </View>
              <View style={styles.sliderTouchArea}>
                {[...Array(11)].map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.sliderTouchPoint}
                    onPress={() => {
                      updateVolume(i / 10);
                    }}
                  />
                ))}
              </View>
            </View>
            <FontAwesome6 name="volume-high" size={14} color={theme.textMuted} />
          </View>

          {/* Speed Control */}
          <View style={styles.settingRow}>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.settingLabel}>0.5x</ThemedText>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${((playbackRate - 0.5) / 1.5) * 100}%` }]} />
                <View style={[styles.sliderThumb, { left: `${((playbackRate - 0.5) / 1.5) * 100}%` }]} />
              </View>
              <View style={styles.sliderTouchArea}>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    style={styles.sliderTouchPoint}
                    onPress={() => {
                      updatePlaybackRate(rate);
                    }}
                  />
                ))}
              </View>
            </View>
            <ThemedText variant="caption" color={theme.textMuted} style={styles.settingLabel}>2.0x</ThemedText>
            <View style={styles.currentSpeedBadge}>
              <ThemedText variant="caption" color={theme.buttonPrimaryText}>{playbackRate}x</ThemedText>
            </View>
          </View>
        </View>
      )}

      {/* Progress Bar with Gradient */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.progressContainer}
        onPress={() => showAudioSettings && setShowAudioSettings(false)}
      >
        <View style={styles.progressBar}>
          {/* 彩虹渐变进度条 */}
          <View style={[styles.progressFillContainer, { width: `${progress}%` }]}>
            <LinearGradient
              colors={['#667eea', '#764ba2', '#f093fb', '#f5576c', '#ffd700']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressGradient}
            />
          </View>
          {/* 进度条发光边框 */}
          <View style={[styles.progressGlow, { width: `${progress}%` }]} />
        </View>
      </TouchableOpacity>

      {/* Main Content with Keyboard Avoiding */}
      <KeyboardAvoidingView 
        style={styles.mainContent}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Sentence Section - 可滚动，支持长按录音 */}
        <ScrollView
          style={styles.sentenceSection}
          contentContainerStyle={styles.sentenceScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isRecording}
          onTouchStart={async (e) => {
            showAudioSettings && setShowAudioSettings(false);
            // 先收起键盘，允许从打字模式切换到语音模式
            Keyboard.dismiss();
            // 记录触摸起点，准备长按录音
            if (!isRecording) {
              touchStartRef.current = {
                x: e.nativeEvent.pageX,
                y: e.nativeEvent.pageY,
                time: Date.now(),
              };
              
              // 【立即】暂停音频，不等待300ms延迟
              // 直接检查音频实际播放状态，不依赖 isPlaying 状态变量
              if (soundRef.current) {
                try {
                  const status = await soundRef.current.getStatusAsync();
                  if (status.isLoaded && status.isPlaying) {
                    // 记录播放状态
                    wasPlayingBeforeRecordingRef.current = true;
                    await soundRef.current.pauseAsync();
                    setIsPlaying(false);
                    console.log('[触摸录音] 立即暂停音频，记录播放状态');
                  }
                } catch (e) {
                  console.log('[触摸录音] 暂停音频失败:', e);
                }
              }
              
              // 延迟300ms开始录音
              recordingTimerRef.current = setTimeout(() => {
                // 确认还在按住状态
                if (touchStartRef.current) {
                  startRecording();
                }
              }, 300);
            }
          }}
          onTouchMove={(e) => {
            // 移动超过20px就取消长按录音
            if (touchStartRef.current && recordingTimerRef.current) {
              const dx = Math.abs(e.nativeEvent.pageX - touchStartRef.current.x);
              const dy = Math.abs(e.nativeEvent.pageY - touchStartRef.current.y);
              if (dx > 20 || dy > 20) {
                clearTimeout(recordingTimerRef.current);
                recordingTimerRef.current = null;
                touchStartRef.current = null;
                
                // 取消录音时恢复音频播放
                if (wasPlayingBeforeRecordingRef.current && isLoopingRef.current && !isRecording) {
                  console.log('[触摸录音] 取消录音，恢复音频');
                  playAudio();
                  wasPlayingBeforeRecordingRef.current = false;
                }
              }
            }
          }}
          onTouchEnd={() => {
            // 记录是否正在录音或正在启动录音（在清除状态之前）
            const wasRecording = isRecording || isStartingRecordingRef.current;
            const wasWaitingToRecord = !!touchStartRef.current && !isRecording && !isStartingRecordingRef.current;
            
            console.log(`[onTouchEnd] isRecording=${isRecording}, isStarting=${isStartingRecordingRef.current}, wasRecording=${wasRecording}, wasWaiting=${wasWaitingToRecord}`);
            
            // 清除计时器
            if (recordingTimerRef.current) {
              clearTimeout(recordingTimerRef.current);
              recordingTimerRef.current = null;
            }
            touchStartRef.current = null;
            
            // 如果正在录音或正在启动录音，停止并识别
            if (wasRecording) {
              // 如果录音还在启动中，等待一下再停止
              if (isStartingRecordingRef.current && !isRecording) {
                // 录音还在启动中，延迟停止
                const checkAndStop = () => {
                  if (recordingRef.current) {
                    stopRecordingAndRecognize();
                  } else {
                    // 还没创建录音对象，清除标记
                    isStartingRecordingRef.current = false;
                    // 恢复播放
                    if (wasPlayingBeforeRecordingRef.current && isLoopingRef.current) {
                      playAudio();
                      wasPlayingBeforeRecordingRef.current = false;
                    }
                  }
                };
                setTimeout(checkAndStop, 100);
              } else {
                stopRecordingAndRecognize();
              }
            } else if (wasWaitingToRecord) {
              // 用户轻触（300ms内松手），没有开始录音
              // 恢复音频播放
              if (wasPlayingBeforeRecordingRef.current && isLoopingRef.current) {
                console.log('[触摸录音] 轻触取消，恢复音频');
                playAudio();
                wasPlayingBeforeRecordingRef.current = false;
              }
            }
          }}
        >
          {/* Sentence Display */}
          <RNAnimated.View style={[styles.sentenceCard, { opacity: RNAnimated.subtract(1, errorAnimRef.current) }]}>
            <View style={styles.wordContainer}>
              {wordStatuses.map((ws, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.wordWrapper}
                  onPress={() => handleWordPress(ws)}
                  activeOpacity={0.7}
                >
                  {ws.isPunctuation ? (
                    <ThemedText variant="h4" color={theme.textPrimary}>
                      {ws.displayText}
                    </ThemedText>
                  ) : (
                    <View style={styles.wordBox}>
                      <View style={styles.wordRow}>
                        {ws.displayText.split('').map((char, charIdx) => {
                          // 判断显示内容
                          let displayChar = char;
                          if (!ws.revealed) {
                            if (hintWordIndex === ws.index) {
                              // 提示模式：显示完整单词
                              displayChar = char;
                            } else {
                              // 正常模式：显示下划线
                              displayChar = '_';
                            }
                          }
                          
                          return (
                            <ThemedText
                              key={charIdx}
                              variant="h4"
                              color={
                                ws.revealed
                                  ? theme.success
                                  : hintWordIndex === ws.index
                                  ? theme.primary // 提示模式下所有字母高亮
                                  : theme.textMuted
                              }
                              style={[
                                styles.char,
                                !ws.revealed && hintWordIndex !== ws.index && styles.hiddenChar,
                              ]}
                            >
                              {displayChar}
                            </ThemedText>
                          );
                        })}
                      </View>
                      {/* 点击单词时显示音标和中文意思 */}
                      {translationWordIndex === ws.index && (
                        <View style={styles.wordInfoContainer}>
                          {/* 音标 */}
                          {wordPhonetics[ws.word] && (
                            <ThemedText 
                              variant="tiny" 
                              color={theme.textMuted}
                              style={styles.phoneticText}
                            >
                              {wordPhonetics[ws.word]}
                            </ThemedText>
                          )}
                          {/* 中文意思 */}
                          <ThemedText 
                            variant="tiny" 
                            color={theme.textSecondary}
                            style={styles.meaningText}
                          >
                            {wordContextMeanings[ws.word] || '...'}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </RNAnimated.View>

          {/* 每句答对的短情绪价值 - 放在句子卡片下方 */}
          {sentencePraise && (
            <View style={styles.sentencePraiseInline}>
              <ThemedText variant="h3" color={theme.success}>{sentencePraise}</ThemedText>
            </View>
          )}

          {/* Translation Display - 放在句子区域内 */}
          {showTranslation && currentTranslation && (
            <View style={styles.translationCard}>
              <ThemedText variant="body" color={theme.textSecondary} style={{ textAlign: 'center' }}>
                {currentTranslation}
              </ThemedText>
            </View>
          )}

          {/* 单词重读录音提示 - 已废弃，保留以兼容旧代码 */}
          {voiceTargetWord && (
            <View style={styles.voiceTargetHint}>
              <ThemedText variant="small" color={theme.textSecondary}>
                请朗读：
              </ThemedText>
              <ThemedText variant="h4" color={theme.primary}>
                {voiceTargetWord}
              </ThemedText>
              <TouchableOpacity onPress={() => setVoiceTargetWord(null)}>
                <FontAwesome6 name="times" size={14} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* 语音识别结果 - 显示用户念的内容，匹配到的单词标绿 */}
          {showVoiceResult && voiceResultText.length > 0 && (
            <Animated.View 
              entering={FadeInDown.duration(300)}
              style={styles.voiceResultCard}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginRight: Spacing.sm }}>
                  <ThemedText variant="small" color={theme.textSecondary}>
                    🎤 你说：
                  </ThemedText>
                  <ThemedText 
                    variant="small" 
                    color={voiceMatchScore >= 80 ? theme.success : voiceMatchScore >= 50 ? theme.accent : theme.textSecondary}
                    style={{ 
                      fontWeight: voiceMatchScore >= 80 ? '600' : '400',
                    }}
                  >
                    {voiceResultText}
                  </ThemedText>
                  {voiceMatchScore > 0 && voiceMatchScore < 100 && (
                    <ThemedText variant="small" color={theme.textMuted} style={{ marginLeft: 8 }}>
                      ({voiceMatchScore}%)
                    </ThemedText>
                  )}
                </View>
                <TouchableOpacity onPress={() => setShowVoiceResult(false)} style={{ paddingTop: 2 }}>
                  <FontAwesome6 name="times" size={14} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {/* 方案B和方案C才显示提示 */}
              {voiceWordMatches.length > 0 && voiceSentenceSuggestion && (
                <View style={styles.segmentSuggestionContainer}>
                  <FontAwesome6 name="lightbulb" size={14} color={theme.accent} />
                  <ThemedText variant="small" color={theme.textSecondary} style={{ flex: 1, marginLeft: 6 }}>
                    {voiceSentenceSuggestion}
                  </ThemedText>
                </View>
              )}
            </Animated.View>
          )}

          {/* Navigation Buttons - 移到文本下方 */}
          <View style={styles.textNavButtons}>
            <TouchableOpacity
              style={[styles.textNavBtn, currentIndex === 0 && styles.navBtnDisabled]}
              onPress={goToPrevSentence}
              disabled={currentIndex === 0}
            >
              <FontAwesome6 name="chevron-left" size={20} color={currentIndex === 0 ? theme.textMuted : theme.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.textNavBtn, currentIndex === sentences.length - 1 && styles.navBtnDisabled]}
              onPress={goToNextSentence}
              disabled={currentIndex === sentences.length - 1}
            >
              <FontAwesome6 name="chevron-right" size={20} color={currentIndex === sentences.length - 1 ? theme.textMuted : theme.primary} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Recording Overlay - 录音时显示大麦克风 */}
        {isRecording && (
          <Animated.View 
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.recordingOverlay}
            pointerEvents="none"
          >
            <View style={styles.recordingMicContainer}>
              <FontAwesome6 name="microphone" size={80} color={theme.buttonPrimaryText} />
              <ThemedText variant="h4" color={theme.buttonPrimaryText} style={{ marginTop: Spacing.lg }}>
                正在录音...
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {/* Input Section */}
        <View style={styles.inputSection}>
          {/* 手机键盘模式 - 仅输入框 */}
          {keyboardType === 'system' && (
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={currentInput}
                onChangeText={handleInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                blurOnSubmit={false}
                textContentType="none"
                autoComplete="off"
              />
              {/* Web端专用麦克风按钮：点击切换录音状态 */}
              {Platform.OS === 'web' && hasRecordingPermission && (
                <TouchableOpacity
                  style={[
                    styles.webMicButton,
                    isRecording && styles.webMicButtonActive,
                  ]}
                  onPress={() => {
                    if (isRecording) {
                      stopRecordingAndRecognize();
                    } else {
                      startRecording();
                    }
                  }}
                >
                  <FontAwesome6 
                    name={isRecording ? "stop" : "microphone"} 
                    size={20} 
                    color={isRecording ? theme.buttonPrimaryText : theme.textMuted} 
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* 自建键盘模式 */}
          {keyboardType === 'custom' && (
            <View style={styles.customKeyboardContainer}>
              {/* 当前输入显示 + Web端麦克风按钮 */}
              <View style={styles.customInputRow}>
                <View style={styles.customInputDisplay}>
                  {currentInput ? (
                    <ThemedText variant="h4" color={theme.success}>
                      {currentInput}
                    </ThemedText>
                  ) : null}
                </View>
                {/* Web端专用麦克风按钮：点击切换录音状态 */}
                {Platform.OS === 'web' && hasRecordingPermission && (
                  <TouchableOpacity
                    style={[
                      styles.webMicButtonCustom,
                      isRecording && styles.webMicButtonActive,
                    ]}
                    onPress={() => {
                      if (isRecording) {
                        stopRecordingAndRecognize();
                      } else {
                        startRecording();
                      }
                    }}
                  >
                    <FontAwesome6 
                      name={isRecording ? "stop" : "microphone"} 
                      size={18} 
                      color={isRecording ? theme.buttonPrimaryText : theme.textMuted} 
                    />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* 自建键盘 */}
              <View style={styles.customKeyboard}>
                {/* 第一列：特殊符号 - 3行均匀分布 */}
                <View style={styles.keyboardColumn}>
                  {/* 连接符 */}
                  <TouchableOpacity
                    style={[styles.keyButton, styles.symbolKey]}
                    onPress={() => handleCustomKeyPress('-', '-')}
                  >
                    <ThemedText variant="h4" color={theme.textPrimary}>-</ThemedText>
                  </TouchableOpacity>
                  {/* 单引号 */}
                  <TouchableOpacity
                    style={[styles.keyButton, styles.symbolKey]}
                    onPress={() => handleCustomKeyPress('\'', '\'')}
                  >
                    <ThemedText variant="h4" color={theme.textPrimary}>&apos;</ThemedText>
                  </TouchableOpacity>
                  {/* &符号 */}
                  <TouchableOpacity
                    style={[styles.keyButton, styles.symbolKey]}
                    onPress={() => handleCustomKeyPress('&', '&')}
                  >
                    <ThemedText variant="h4" color={theme.textPrimary}>&amp;</ThemedText>
                  </TouchableOpacity>
                </View>

                {/* 第二到第四列：字母 - 3行均匀分布 */}
                <View style={styles.keyboardLetterSection}>
                  {/* 第一行 */}
                  <View style={styles.keyboardRow}>
                    <TouchableOpacity
                      style={[styles.keyButton, styles.letterKey, showNumberPanel && styles.numberKeyActive]}
                      onPress={() => setShowNumberPanel(!showNumberPanel)}
                    >
                      <ThemedText variant="body" color={showNumberPanel ? theme.primary : theme.textMuted}>数字</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.keyButton, styles.letterKey]}
                      onPress={() => handleCustomKeyPress('ABC', 'ABC')}
                    >
                      <ThemedText variant="h4" color={theme.textPrimary}>ABC</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.keyButton, styles.letterKey]}
                      onPress={() => handleCustomKeyPress('DEF', 'DEF')}
                    >
                      <ThemedText variant="h4" color={theme.textPrimary}>DEF</ThemedText>
                    </TouchableOpacity>
                  </View>
                  
                  {/* 第二行 - 字母或数字 */}
                  {showNumberPanel ? (
                    <View style={styles.keyboardRow}>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[styles.keyButton, styles.letterKey]}
                          onPress={() => {
                            // 取消之前的延迟确认定时器
                            if (confirmTimerRef.current) {
                              clearTimeout(confirmTimerRef.current);
                              confirmTimerRef.current = null;
                            }
                            // 直接输入数字
                            const newInput = currentInput + num.toString();
                            setCurrentInput(newInput);
                            // 位置优先：找到第一个匹配的单词（按位置排序）
                            const allMatches = wordStatuses.filter(ws => 
                              !ws.isPunctuation && !ws.revealed && ws.word.toLowerCase() === newInput.toLowerCase()
                            );
                            if (allMatches.length > 0) {
                              // 按位置排序，选择最靠前的
                              const matched = allMatches.sort((a, b) => a.index - b.index)[0];
                              setTargetWordIndexWithRef(matched.index);
                              // 延迟确认
                              confirmTimerRef.current = setTimeout(() => {
                                handleInputChange(newInput);
                                setCurrentInput('');
                                setCurrentKeySequence([]);
                                setTargetWordIndexWithRef(null);
                                setShowNumberPanel(false);
                                confirmTimerRef.current = null;
                              }, 500);
                            }
                          }}
                        >
                          <ThemedText variant="h4" color={theme.textPrimary}>{num}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.keyboardRow}>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('GHI', 'GHI')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>GHI</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('JKL', 'JKL')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>JKL</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('MNO', 'MNO')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>MNO</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* 第三行 - 数字或字母 */}
                  {showNumberPanel ? (
                    <View style={styles.keyboardRow}>
                      {[6, 7, 8, 9, 0].map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={[styles.keyButton, styles.letterKey]}
                          onPress={() => {
                            // 取消之前的延迟确认定时器
                            if (confirmTimerRef.current) {
                              clearTimeout(confirmTimerRef.current);
                              confirmTimerRef.current = null;
                            }
                            // 直接输入数字
                            const newInput = currentInput + num.toString();
                            setCurrentInput(newInput);
                            // 位置优先：找到第一个匹配的单词（按位置排序）
                            const allMatches = wordStatuses.filter(ws => 
                              !ws.isPunctuation && !ws.revealed && ws.word.toLowerCase() === newInput.toLowerCase()
                            );
                            if (allMatches.length > 0) {
                              // 按位置排序，选择最靠前的
                              const matched = allMatches.sort((a, b) => a.index - b.index)[0];
                              setTargetWordIndexWithRef(matched.index);
                              // 延迟确认
                              confirmTimerRef.current = setTimeout(() => {
                                handleInputChange(newInput);
                                setCurrentInput('');
                                setCurrentKeySequence([]);
                                setTargetWordIndexWithRef(null);
                                setShowNumberPanel(false);
                                confirmTimerRef.current = null;
                              }, 500);
                            }
                          }}
                        >
                          <ThemedText variant="h4" color={theme.textPrimary}>{num}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.keyboardRow}>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('PQRS', 'PQRS')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>PQRS</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('TUV', 'TUV')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>TUV</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.keyButton, styles.letterKey]}
                        onPress={() => handleCustomKeyPress('WXYZ', 'WXYZ')}
                      >
                        <ThemedText variant="h4" color={theme.textPrimary}>WXYZ</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 第五列：功能键 - 3行均匀分布 */}
                <View style={styles.keyboardColumn}>
                  <TouchableOpacity
                    style={[styles.keyButton, styles.functionKey]}
                    onPress={() => handleCustomKeyPress('⌫', '')}
                  >
                    <FontAwesome6 name="delete-left" size={22} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.keyButton, styles.functionKey]}
                    onPress={() => handleCustomKeyPress('清空', '')}
                  >
                    <ThemedText variant="body" color={theme.textPrimary}>清空</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.keyButton, styles.functionKey]}
                    onPress={() => handleCustomKeyPress('空格', '')}
                  >
                    <ThemedText variant="body" color={theme.textPrimary}>空格</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* 音频源选择面板 */}
      {showAudioSourcePanel && (
        <View style={styles.perfectRecordingsOverlay}>
          <TouchableOpacity 
            style={styles.perfectRecordingsBackdrop}
            onPress={() => {
              setShowAudioSourcePanel(false);
              // 恢复播放
              if (wasPlayingBeforePanelRef.current) {
                playAudio();
              }
            }}
            activeOpacity={1}
          />
          <View style={[styles.perfectRecordingsPanel, { backgroundColor: theme.backgroundDefault, maxHeight: '70%' }]}>
            <View style={[styles.perfectRecordingsHeader, { borderBottomColor: theme.border }]}>
              <ThemedText variant="h4" color={theme.textPrimary}>选择播放音源</ThemedText>
              <TouchableOpacity onPress={() => {
                setShowAudioSourcePanel(false);
                if (wasPlayingBeforePanelRef.current) {
                  playAudio();
                }
              }}>
                <FontAwesome6 name="times" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.perfectRecordingsList}>
              {/* AI 音色 */}
              <View style={{ paddingVertical: Spacing.sm }}>
                <ThemedText variant="caption" color={theme.textMuted} style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.xs }}>
                  AI 音色
                </ThemedText>
                {aiVoicesRef.current.map((voice) => {
                  const isSelected = selectedSourceIds.includes(voice.id);
                  const isCurrentlyPlaying = selectedSourceIds[currentPlayingSourceIndex] === voice.id;
                  return (
                    <TouchableOpacity
                      key={voice.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: Spacing.md,
                        paddingHorizontal: Spacing.md,
                        backgroundColor: isSelected ? theme.primary + '10' : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: theme.borderLight,
                      }}
                      onPress={() => {
                        setSelectedSourceIds(prev => {
                          if (prev.includes(voice.id)) {
                            // 取消选中，但至少保留一个
                            if (prev.length <= 1) return prev;
                            return prev.filter(id => id !== voice.id);
                          } else {
                            return [...prev, voice.id];
                          }
                        });
                        setCurrentPlayingSourceIndex(0);
                      }}
                    >
                      <FontAwesome6 
                        name={isSelected ? "check-square" : "square"} 
                        size={20} 
                        color={isSelected ? theme.primary : theme.textMuted} 
                      />
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <ThemedText variant="body" color={theme.textPrimary}>{voice.name}</ThemedText>
                      </View>
                      {isCurrentlyPlaying && isPlaying && (
                        <FontAwesome6 name="volume-high" size={14} color={theme.primary} />
                      )}
                      {voice.id === 'ai_weiwei' && (
                        <View style={{ backgroundColor: theme.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: Spacing.xs }}>
                          <ThemedText variant="tiny" color={theme.accent}>推荐</ThemedText>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {/* 我的发音 */}
              <View style={{ paddingVertical: Spacing.sm }}>
                <ThemedText variant="caption" color={theme.textMuted} style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.xs }}>
                  我的发音 {perfectRecordings.length > 0 && `(${perfectRecordings.length})`}
                </ThemedText>
                {perfectRecordings.length > 0 ? (
                  perfectRecordings.slice(0, 3).map((record: any, idx: number) => {
                    const sourceId = `mine_${record.id}`;
                    const isSelected = selectedSourceIds.includes(sourceId);
                    const isCurrentlyPlaying = selectedSourceIds[currentPlayingSourceIndex] === sourceId;
                    return (
                      <TouchableOpacity
                        key={sourceId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: Spacing.md,
                          paddingHorizontal: Spacing.md,
                          backgroundColor: isSelected ? theme.primary + '10' : 'transparent',
                          borderBottomWidth: 1,
                          borderBottomColor: theme.borderLight,
                        }}
                        onPress={() => {
                          setSelectedSourceIds(prev => {
                            if (prev.includes(sourceId)) {
                              if (prev.length <= 1) return prev;
                              return prev.filter(id => id !== sourceId);
                            } else {
                              return [...prev, sourceId];
                            }
                          });
                          setCurrentPlayingSourceIndex(0);
                        }}
                      >
                        <FontAwesome6 
                          name={isSelected ? "check-square" : "square"} 
                          size={20} 
                          color={isSelected ? theme.primary : theme.textMuted} 
                        />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText variant="body" color={theme.textPrimary}>我的一遍过 #{idx + 1}</ThemedText>
                          <ThemedText variant="caption" color={theme.textMuted}>
                            {new Date(record.created_at).toLocaleDateString()}
                          </ThemedText>
                        </View>
                        {isCurrentlyPlaying && isPlaying && (
                          <FontAwesome6 name="volume-high" size={14} color={theme.primary} />
                        )}
                        <TouchableOpacity
                          style={{ padding: Spacing.xs }}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (record.audio_url) {
                              playPreviewAudio(record.audio_url);
                            }
                          }}
                        >
                          <FontAwesome6 name="play" size={14} color={theme.success} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      暂无我的发音，完成一遍过练习后会自动保存
                    </ThemedText>
                  </View>
                )}
              </View>
              
              {/* 社区分享 */}
              <View style={{ paddingVertical: Spacing.sm }}>
                <ThemedText variant="caption" color={theme.textMuted} style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.xs }}>
                  社区分享 {publicRecordings.length > 0 && `(${publicRecordings.length})`}
                </ThemedText>
                {publicRecordings.length > 0 ? (
                  publicRecordings.slice(0, 3).map((record: any, idx: number) => {
                    const sourceId = `community_${record.id}`;
                    const isSelected = selectedSourceIds.includes(sourceId);
                    const isCurrentlyPlaying = selectedSourceIds[currentPlayingSourceIndex] === sourceId;
                    return (
                      <TouchableOpacity
                        key={sourceId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: Spacing.md,
                          paddingHorizontal: Spacing.md,
                          backgroundColor: isSelected ? theme.primary + '10' : 'transparent',
                          borderBottomWidth: 1,
                          borderBottomColor: theme.borderLight,
                        }}
                        onPress={() => {
                          setSelectedSourceIds(prev => {
                            if (prev.includes(sourceId)) {
                              if (prev.length <= 1) return prev;
                              return prev.filter(id => id !== sourceId);
                            } else {
                              return [...prev, sourceId];
                            }
                          });
                          setCurrentPlayingSourceIndex(0);
                        }}
                      >
                        <FontAwesome6 
                          name={isSelected ? "check-square" : "square"} 
                          size={20} 
                          color={isSelected ? theme.primary : theme.textMuted} 
                        />
                        <View style={{ flex: 1, marginLeft: Spacing.md }}>
                          <ThemedText variant="body" color={theme.textPrimary}>
                            {record.user_nickname || '匿名用户'}的发音
                          </ThemedText>
                          <ThemedText variant="caption" color={theme.textMuted}>
                            {record.duration_seconds > 0 ? `${record.duration_seconds}秒` : ''}
                          </ThemedText>
                        </View>
                        {isCurrentlyPlaying && isPlaying && (
                          <FontAwesome6 name="volume-high" size={14} color={theme.primary} />
                        )}
                        <TouchableOpacity
                          style={{ padding: Spacing.xs }}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (record.audio_url) {
                              playPreviewAudio(record.audio_url);
                            }
                          }}
                        >
                          <FontAwesome6 name="play" size={14} color={theme.success} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>
                    <ThemedText variant="caption" color={theme.textMuted}>
                      暂无社区分享的发音
                    </ThemedText>
                  </View>
                )}
              </View>
              
              {/* 提示 */}
              <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                <ThemedText variant="caption" color={theme.textMuted}>
                  选中多个音源将轮流播放
                </ThemedText>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* 课程完成弹窗 */}
      <CompletionModal
        visible={showCompletionModal}
        duration={completionDuration}
        sentenceCount={sentences.length}
        hasNextLesson={sourceType === 'lesson' && !!nextLessonId}
        nextLessonTitle={nextLessonTitle}
        onClose={handleCompletionClose}
        theme={theme}
        typingAccuracy={completionStats.typingAccuracy}
        voiceAttempts={completionStats.voiceAttempts}
        voiceSuccesses={completionStats.voiceSuccesses}
        hintUsedCount={completionStats.hintUsedCount}
        firstTryRate={completionStats.firstTryRate}
      />
    </Screen>
  );
}
