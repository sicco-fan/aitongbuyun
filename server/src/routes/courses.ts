import express, { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { TTSClient, Config, HeaderUtils, S3Storage, LLMClient, FetchClient } from 'coze-coding-dev-sdk';
import axios from 'axios';

const router = Router();

// 配置 multer 用于处理 PDF 上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

/**
 * 使用 AI 智能识别课时结构（分批解析，按 Unit 分割）
 * 支持各种不同格式的教材（如 starter unit、unit1、unitN、Lesson X 等）
 */
async function parseLessonsWithAI(text: string): Promise<Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}>> {
  console.log('[AI解析] 开始使用 AI 智能识别课时结构...');
  console.log('[AI解析] 原始文本长度:', text.length);
  
  const config = new Config();
  const client = new LLMClient(config);
  
  // 短文本直接解析
  if (text.length <= 6000) {
    return await parseSingleBatch(client, text, 1);
  }
  
  // 长文本：按 Unit 边界分割，分批解析
  console.log('[AI解析] 文本较长，尝试按 Unit 分割...');
  
  // 识别 Unit 边界（支持多种格式）
  // 格式：Unit 1, Unit1, UNIT 1, unit 1, Starter Unit, Lesson 1 等
  const unitPatterns = [
    /(?:^|\n)\s*(Unit\s*\d+|Starter\s*Unit|UNIT\s*\d+|Lesson\s*\d+)/gi,
    /(?:^|\n)\s*(Unit\s*\d+\s*:)/gi,
  ];
  
  // 找到所有 Unit 边界
  const unitBoundaries: { index: number; title: string }[] = [];
  
  for (const pattern of unitPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const title = match[1].trim();
      // 避免重复
      if (!unitBoundaries.some(b => Math.abs(b.index - match!.index) < 10)) {
        unitBoundaries.push({ index: match.index, title });
      }
    }
  }
  
  // 按位置排序
  unitBoundaries.sort((a, b) => a.index - b.index);
  
  console.log(`[AI解析] 识别到 ${unitBoundaries.length} 个 Unit 边界:`);
  unitBoundaries.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.title} @ ${b.index}`);
  });
  
  // 如果没有识别到 Unit 边界，或者 Unit 数量太少，回退到整体解析
  if (unitBoundaries.length < 2) {
    console.log('[AI解析] 未识别到足够的 Unit 边界，回退到整体解析...');
    return await parseAsSingleBatch(client, text);
  }
  
  // 按 Unit 边界分割文本
  const unitTexts: string[] = [];
  for (let i = 0; i < unitBoundaries.length; i++) {
    const start = unitBoundaries[i].index;
    const end = i < unitBoundaries.length - 1 ? unitBoundaries[i + 1].index : text.length;
    const unitText = text.substring(start, end).trim();
    if (unitText.length > 100) { // 忽略太短的片段
      unitTexts.push(unitText);
    }
  }
  
  console.log(`[AI解析] 分割为 ${unitTexts.length} 个片段，开始分批解析...`);
  
  // 分批解析每个 Unit
  const allLessons: Array<{
    lesson_number: number;
    title: string;
    description?: string;
    sentences: Array<{ english: string; chinese?: string }>;
  }> = [];
  
  for (let i = 0; i < unitTexts.length; i++) {
    console.log(`[AI解析] 解析第 ${i + 1}/${unitTexts.length} 个片段 (${unitTexts[i].length} 字符)...`);
    
    try {
      const lessons = await parseSingleUnit(client, unitTexts[i], allLessons.length + 1);
      if (lessons.length > 0) {
        allLessons.push(...lessons);
        console.log(`[AI解析] 第 ${i + 1} 个片段解析成功，获得 ${lessons.length} 个课时`);
      }
    } catch (error: any) {
      console.error(`[AI解析] 第 ${i + 1} 个片段解析失败:`, error.message);
      // 继续解析下一个片段
    }
  }
  
  console.log(`[AI解析] 分批解析完成，共 ${allLessons.length} 个课时`);
  return allLessons;
}

/**
 * 整体解析（回退方案）
 */
async function parseAsSingleBatch(client: LLMClient, text: string): Promise<Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}>> {
  const systemPrompt = `你是英语教材解析助手。分析文本，识别课时结构。

返回格式（紧凑JSON数组）：
[{"n":1,"t":"标题","s":[{"e":"英文","c":"中文"}]}]

规则：
1. n=课时号，t=标题，s=句子数组，e=英文，c=中文
2. 识别 Unit 1、Lesson 1 等课时标记
3. 每个句子英文和中文成对
4. 只返回JSON，不要代码块标记
5. 确保JSON完整有效`;

  const truncatedText = text.length > 12000 ? text.substring(0, 12000) : text;
  
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `分析以下教材，返回紧凑JSON数组：\n\n${truncatedText}` }
  ];
  
  const response = await client.invoke(messages, { 
    model: 'doubao-seed-1-6-lite-251015',
    temperature: 0.1
  });
  
  const content = response.content.trim();
  console.log('[AI解析] AI 返回内容长度:', content.length);
  
  let jsonStr = extractJSON(content);
  
  try {
    const lessons = JSON.parse(jsonStr);
    return normalizeLessons(lessons);
  } catch (parseError) {
    console.log('[AI解析] JSON 解析失败，尝试修复...');
    jsonStr = fixTruncatedJSON(jsonStr);
    const lessons = JSON.parse(jsonStr);
    return normalizeLessons(lessons);
  }
}

/**
 * 解析单个 Unit 片段
 */
async function parseSingleUnit(client: LLMClient, text: string, startLessonNumber: number): Promise<Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}>> {
  const systemPrompt = `你是英语教材解析助手。分析单个 Unit 的文本，识别其中的对话和句子。

返回格式（紧凑JSON数组）：
[{"n":1,"t":"对话标题","s":[{"e":"英文","c":"中文"}]}]

规则：
1. n=对话序号（从1开始），t=对话标题，s=句子数组，e=英文，c=中文
2. 识别对话中的每一句话，英文和中文成对
3. 如果一个 Unit 有多个对话，分别返回
4. 只返回JSON数组，不要代码块标记
5. 确保JSON完整有效`;

  // 限制单个 Unit 的文本长度
  const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;
  
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `分析以下 Unit 文本：\n\n${truncatedText}` }
  ];
  
  const response = await client.invoke(messages, { 
    model: 'doubao-seed-1-6-lite-251015',
    temperature: 0.1
  });
  
  const content = response.content.trim();
  
  let jsonStr = extractJSON(content);
  
  try {
    const lessons = JSON.parse(jsonStr);
    return normalizeLessons(lessons, startLessonNumber);
  } catch (parseError) {
    console.log('[AI解析] 单片段 JSON 解析失败，尝试修复...');
    jsonStr = fixTruncatedJSON(jsonStr);
    const lessons = JSON.parse(jsonStr);
    return normalizeLessons(lessons, startLessonNumber);
  }
}

/**
 * 标准化课时数据
 */
function normalizeLessons(lessons: any[], startLessonNumber: number = 1): Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}> {
  if (!Array.isArray(lessons)) return [];
  
  return lessons.filter((lesson: any) => {
    const hasSentences = lesson.s?.length > 0 || lesson.sentences?.length > 0;
    return lesson && hasSentences;
  }).map((lesson: any, idx: number) => ({
    // 始终使用 startLessonNumber + idx，确保分批解析时编号连续且不重复
    lesson_number: startLessonNumber + idx,
    title: lesson.t || lesson.title || `Lesson ${startLessonNumber + idx}`,
    description: lesson.t || lesson.title || lesson.description || `Lesson ${startLessonNumber + idx}`,
    sentences: (lesson.s || lesson.sentences || []).filter((s: any) => s && (s.e || s.english)).map((s: any) => ({
      english: (s.e || s.english || '').trim(),
      chinese: (s.c || s.chinese || '')?.trim()
    }))
  }));
}

/**
 * 从 AI 响应中提取 JSON
 */
function extractJSON(content: string): string {
  // 如果返回内容包含 markdown 代码块，提取其中的 JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    console.log('[AI解析] 从代码块中提取 JSON');
    return jsonMatch[1].trim();
  }
  
  // 尝试找到 JSON 数组的开始和结束
  const jsonStart = content.indexOf('[');
  const jsonEnd = content.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    console.log('[AI解析] 从文本中提取 JSON 数组');
    return content.substring(jsonStart, jsonEnd + 1);
  }
  
  return content;
}

/**
 * 修复截断的 JSON
 * 策略：向后搜索，找到最后一个完整的课时对象，丢弃截断部分
 */
function fixTruncatedJSON(jsonStr: string): string {
  console.log('[AI解析] 尝试修复截断的 JSON...');
  console.log('[AI解析] 原始 JSON 长度:', jsonStr.length);
  
  // 检查是否以 ] 结尾（完整JSON）
  const trimmed = jsonStr.trim();
  if (trimmed.endsWith(']')) {
    try {
      JSON.parse(trimmed);
      console.log('[AI解析] JSON 已经完整，无需修复');
      return trimmed;
    } catch (e) {
      // 继续修复
    }
  }
  
  // 策略：找到最后一个完整的课时对象
  // 课时对象的分隔符是 },{ 或 }]（最后一个课时）
  // 我们向后搜索，找到 "n":数字 或 "lesson_number":数字 的完整课时
  
  // 尝试多个截断点，从后往前找
  const truncatePatterns = [
    /\},\s*\{"n":\d+/g,           // },{n:数字
    /\},\s*\{"lesson_number":\d+/g, // },{lesson_number:数字
    /\}\s*\]/g,                    // }]
  ];
  
  // 方法1：找到最后一个完整的课时分隔点
  // 向后搜索 "n":X 后面的 },{ 的位置
  const lessonSeparator = /\},\s*\{"/g;
  const separators: number[] = [];
  let match;
  while ((match = lessonSeparator.exec(jsonStr)) !== null) {
    separators.push(match.index + 1); // 保留前面的 }
  }
  
  console.log('[AI解析] 找到课时分隔点数量:', separators.length);
  
  // 从后往前尝试每个截断点
  for (let i = separators.length - 1; i >= 0; i--) {
    const truncateAt = separators[i];
    const candidate = jsonStr.substring(0, truncateAt + 1) + ']'; // 闭合数组
    
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[AI解析] 在分隔点 ${i} 处成功截断，保留 ${parsed.length} 个课时`);
        return candidate;
      }
    } catch (e) {
      // 继续尝试前一个分隔点
      continue;
    }
  }
  
  // 方法2：尝试找最后一个完整的 sentences 数组
  const lastSentencesEnd = jsonStr.lastIndexOf('"}]');
  if (lastSentencesEnd > 0) {
    // 从这个位置往前找对应的课时开始
    const candidate = jsonStr.substring(0, lastSentencesEnd + 3) + ']';
    
    // 需要找到这个课时对象在哪里结束
    // 尝试解析
    try {
      // 先尝试直接加 ] 闭合
      const testStr = jsonStr.substring(0, lastSentencesEnd + 3);
      // 计算需要闭合的括号
      const bracketResult = countBrackets(testStr);
      const closed = testStr + bracketResult.closing;
      const parsed = JSON.parse(closed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[AI解析] 通过 sentences 数组截断成功，保留 ${parsed.length} 个课时`);
        return closed;
      }
    } catch (e) {
      // 继续
    }
  }
  
  // 方法3：找最后一个完整的句子
  const lastCompleteSentence = jsonStr.lastIndexOf('"},');
  if (lastCompleteSentence > 0) {
    // 截断到最后一个完整的句子，然后闭合
    let candidate = jsonStr.substring(0, lastCompleteSentence + 2); // 保留 "}
    
    // 计算括号并闭合
    const bracketResult = countBrackets(candidate);
    candidate += bracketResult.closing;
    
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[AI解析] 通过句子截断成功，保留 ${parsed.length} 个课时`);
        return candidate;
      }
    } catch (e) {
      // 继续
    }
  }
  
  // 方法4：最后尝试 - 只保留第一个课时
  // 找到第一个课时结束后立即截断
  const firstLessonEnd = jsonStr.indexOf('},{"n":');
  if (firstLessonEnd > 0) {
    let candidate = jsonStr.substring(0, firstLessonEnd + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      console.log('[AI解析] 只保留了第一个课时');
      return candidate;
    } catch (e) {
      // 最后的努力：尝试第一个课时的另一种格式
    }
  }
  
  // 尝试第一种格式的第一个课时
  const firstLessonEndAlt = jsonStr.indexOf('},{"lesson_number":');
  if (firstLessonEndAlt > 0) {
    let candidate = jsonStr.substring(0, firstLessonEndAlt + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      console.log('[AI解析] 只保留了第一个课时（格式2）');
      return candidate;
    } catch (e) {
      // 放弃
    }
  }
  
  console.log('[AI解析] 所有修复策略都失败了');
  throw new Error('无法修复截断的 JSON');
}

/**
 * 计算 JSON 字符串中需要闭合的括号
 */
function countBrackets(str: string): { depth: number; closing: string } {
  let inString = false;
  let escapeNext = false;
  const stack: string[] = [];
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        stack.pop();
      }
    }
  }
  
  // 返回需要按顺序闭合的括号
  return {
    depth: stack.length,
    closing: stack.reverse().join('')
  };
}

/**
 * 解析单批文本（用于短文本或测试）
 */
async function parseSingleBatch(client: LLMClient, text: string, startLessonNumber: number): Promise<Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}>> {
  const systemPrompt = `你是英语教材解析助手。分析文本，识别课时结构。

返回格式（紧凑JSON）：
[{"n":1,"t":"标题","s":[{"e":"英文","c":"中文"}]}]

规则：
1. 识别 Unit 1、Lesson 1 等课时标记
2. 英文和中文成对出现
3. 只返回JSON数组`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `分析教材返回JSON：\n${text}` }
  ];
  
  const response = await client.invoke(messages, { 
    model: 'doubao-seed-1-6-lite-251015',
    temperature: 0.1
  });
  
  const content = response.content.trim();
  let jsonStr = extractJSON(content);
  
  try {
    jsonStr = fixTruncatedJSON(jsonStr);
    const lessons = JSON.parse(jsonStr);
    
    return lessons.filter((l: any) => l.s?.length > 0).map((l: any, idx: number) => ({
      lesson_number: l.n || idx + startLessonNumber,
      title: l.t || `Unit ${l.n || idx + startLessonNumber}`,
      sentences: l.s.map((s: any) => ({
        english: (s.e || '').trim(),
        chinese: (s.c || '')?.trim()
      }))
    }));
  } catch (e) {
    console.error('[AI解析] 单批解析失败:', e);
    return [];
  }
}

// 定义可用的音色
// 注意：当前TTS服务仅支持中文音色，但部分音色支持双语（中英）
// 对于英语学习，推荐使用双语音色
const AVAILABLE_VOICES = [
  // 英语学习推荐音色（双语）
  { 
    id: 'zh_female_vv_uranus_bigtts', 
    name: '薇薇（双语女声）', 
    gender: 'female', 
    style: 'bilingual',
    description: '中英双语音色，适合英语学习',
    recommended: true 
  },
  
  // 中文通用音色（也可朗读英语，但口音较重）
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '晓荷', gender: 'female', style: 'general', description: '中文通用女声' },
  { id: 'zh_male_m191_uranus_bigtts', name: '云舟', gender: 'male', style: 'general', description: '中文通用男声' },
  { id: 'zh_male_taocheng_uranus_bigtts', name: '晓天', gender: 'male', style: 'general', description: '中文通用男声' },
  { id: 'zh_female_xueayi_saturn_bigtts', name: '雪阿姨', gender: 'female', style: 'audiobook', description: '儿童有声书' },
  { id: 'zh_male_dayi_saturn_bigtts', name: '大义', gender: 'male', style: 'video', description: '视频配音' },
];

/**
 * GET /api/v1/courses
 * 获取课程列表（包含实际句子数）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    
    const { data: courses, error } = await supabase
      .from('courses')
      .select('*')
      .order('book_number', { ascending: true });
    
    if (error) {
      throw new Error(error.message);
    }
    
    // 获取每个课程的实际句子数
    const coursesWithSentences = await Promise.all(
      (courses || []).map(async (course) => {
        // 获取该课程所有课时的句子数
        const { data: lessons } = await supabase
          .from('lessons')
          .select('sentences_count')
          .eq('course_id', course.id);
        
        const totalSentences = lessons?.reduce((sum, l) => sum + (l.sentences_count || 0), 0) || 0;
        
        return {
          ...course,
          total_sentences: totalSentences,
        };
      })
    );
    
    res.json({ courses: coursesWithSentences });
  } catch (error: any) {
    console.error('获取课程列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/courses/:courseId/lessons
 * 获取指定课程的课时列表
 */
router.get('/:courseId/lessons', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const supabase = getSupabaseClient();
    
    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('lesson_number', { ascending: true });
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ lessons });
  } catch (error: any) {
    console.error('获取课时列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/courses/lessons/:lessonId
 * 获取指定课时的详细信息（包含所有句子）
 */
router.get('/lessons/:lessonId', async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { voiceId } = req.query;
    const supabase = getSupabaseClient();
    
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();
    
    if (lessonError || !lesson) {
      return res.status(404).json({ error: '课时不存在' });
    }
    
    const { data: sentences, error: sentencesError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sentence_index', { ascending: true });
    
    if (sentencesError) {
      throw new Error(sentencesError.message);
    }
    
    const sentenceIds = (sentences || []).map(s => s.id);
    const { data: allAudios } = await supabase
      .from('lesson_sentence_audio')
      .select('*')
      .in('sentence_id', sentenceIds);
    
    const audiosBySentence: Record<number, any[]> = {};
    (allAudios || []).forEach(audio => {
      if (!audiosBySentence[audio.sentence_id]) {
        audiosBySentence[audio.sentence_id] = [];
      }
      audiosBySentence[audio.sentence_id].push(audio);
    });
    
    const sentencesWithAudio = await Promise.all(
      (sentences || []).map(async (sentence) => {
        const audios = audiosBySentence[sentence.id] || [];
        let targetAudio = audios[0];
        if (voiceId) {
          targetAudio = audios.find(a => a.voice_id === voiceId) || null;
        }
        
        let audioUrl = null;
        let duration = null;
        let availableVoices: string[] = [];
        
        if (targetAudio) {
          audioUrl = await storage.generatePresignedUrl({ 
            key: targetAudio.audio_url, 
            expireTime: 86400 
          });
          duration = targetAudio.duration;
          availableVoices = audios.map(a => a.voice_id);
        }
        
        return {
          ...sentence,
          audio_url: audioUrl,
          audio_duration: duration,
          available_voices: availableVoices,
        };
      })
    );
    
    res.json({ 
      lesson,
      sentences: sentencesWithAudio,
      available_voices: AVAILABLE_VOICES,
    });
  } catch (error: any) {
    console.error('获取课时详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/courses/lessons/:lessonId/sentences/:sentenceIndex/audio
 */
router.get('/lessons/:lessonId/sentences/:sentenceIndex/audio', async (req: Request, res: Response) => {
  try {
    const { lessonId, sentenceIndex } = req.params;
    const { voiceId = 'zh_female_xiaohe_uranus_bigtts' } = req.query;
    const supabase = getSupabaseClient();
    
    const { data: sentence, error: sentenceError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('sentence_index', sentenceIndex)
      .single();
    
    if (sentenceError || !sentence) {
      return res.status(404).json({ error: '句子不存在' });
    }
    
    const { data: audio, error: audioError } = await supabase
      .from('lesson_sentence_audio')
      .select('*')
      .eq('sentence_id', sentence.id)
      .eq('voice_id', voiceId)
      .single();
    
    if (audioError || !audio) {
      return res.status(404).json({ error: '该音色的音频尚未生成' });
    }
    
    const audioUrl = await storage.generatePresignedUrl({ 
      key: audio.audio_url, 
      expireTime: 86400 
    });
    
    res.json({ 
      audio_url: audioUrl,
      duration: audio.duration,
      voice_id: audio.voice_id,
      voice_name: audio.voice_name,
    });
  } catch (error: any) {
    console.error('获取句子音频失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/courses
 * 创建新课程
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, book_number, description, cover_image } = req.body;
    const supabase = getSupabaseClient();
    
    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        title,
        book_number,
        description,
        cover_image,
        total_lessons: 0,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ course });
  } catch (error: any) {
    console.error('创建课程失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/courses/:courseId/lessons
 * 创建新课时
 */
router.post('/:courseId/lessons', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { lesson_number, title, description, sentences } = req.body;
    const supabase = getSupabaseClient();
    
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .insert({
        course_id: parseInt(courseId as string),
        lesson_number,
        title,
        description,
        sentences_count: sentences?.length || 0,
      })
      .select()
      .single();
    
    if (lessonError) {
      throw new Error(lessonError.message);
    }
    
    if (sentences && sentences.length > 0) {
      const sentencesData = sentences.map((s: any, index: number) => ({
        lesson_id: lesson.id,
        sentence_index: index + 1,
        english_text: s.english_text,
        chinese_text: s.chinese_text,
      }));
      
      const { error: sentencesError } = await supabase
        .from('lesson_sentences')
        .insert(sentencesData);
      
      if (sentencesError) {
        throw new Error(sentencesError.message);
      }
    }
    
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);
    
    await supabase
      .from('courses')
      .update({ total_lessons: lessons?.length || 0 })
      .eq('id', courseId);
    
    res.json({ lesson });
  } catch (error: any) {
    console.error('创建课时失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/courses/lessons/:lessonId/generate-audio
 * 为指定课时的所有句子生成AI语音（使用SSE流式返回进度）
 */
router.post('/lessons/:lessonId/generate-audio', async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  const { voiceIds } = req.body;
  const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
  
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  
  const sendProgress = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    const supabase = getSupabaseClient();
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);
    
    // 获取课时句子
    const { data: sentences, error: sentencesError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sentence_index', { ascending: true });
    
    if (sentencesError) {
      throw new Error(sentencesError.message);
    }
    
    if (!sentences || sentences.length === 0) {
      sendProgress({ type: 'error', message: '课时没有句子' });
      res.write('data: [DONE]\n\n');
      return;
    }
    
    // 确定要生成的音色
    const voicesToGenerate = voiceIds && voiceIds.length > 0 
      ? AVAILABLE_VOICES.filter(v => voiceIds.includes(v.id))
      : AVAILABLE_VOICES;
    
    if (voicesToGenerate.length === 0) {
      sendProgress({ type: 'error', message: '没有有效的音色' });
      res.write('data: [DONE]\n\n');
      return;
    }
    
    // 计算总任务数
    const totalTasks = sentences.length * voicesToGenerate.length;
    let completedTasks = 0;
    let generatedCount = 0;
    let alreadyExistsCount = 0;
    let failedCount = 0;
    
    // 发送开始事件
    sendProgress({
      type: 'start',
      total: totalTasks,
      sentences: sentences.length,
      voices: voicesToGenerate.length,
    });
    
    // 为每个句子生成每种音色的音频
    for (const sentence of sentences) {
      for (const voice of voicesToGenerate) {
        try {
          // 检查是否已存在
          const { data: existing } = await supabase
            .from('lesson_sentence_audio')
            .select('id')
            .eq('sentence_id', sentence.id)
            .eq('voice_id', voice.id)
            .single();
          
          if (existing) {
            alreadyExistsCount++;
            completedTasks++;
            sendProgress({
              type: 'progress',
              current: completedTasks,
              total: totalTasks,
              percent: Math.round((completedTasks / totalTasks) * 100),
              sentence_index: sentence.sentence_index,
              voice_name: voice.name,
              status: 'already_exists',
            });
            continue;
          }
          
          // 调用TTS生成音频
          const ttsResponse = await ttsClient.synthesize({
            uid: `lesson_${lessonId}`,
            text: sentence.english_text,
            speaker: voice.id,
            audioFormat: 'mp3',
            sampleRate: 24000,
          });
          
          // 下载音频数据
          const audioResponse = await axios.get(ttsResponse.audioUri, { 
            responseType: 'arraybuffer' 
          });
          const audioBuffer = Buffer.from(audioResponse.data);
          
          // 上传到对象存储
          const audioKey = await storage.uploadFile({
            fileContent: audioBuffer,
            fileName: `lessons/${lessonId}/sentence_${sentence.sentence_index}_${voice.id}.mp3`,
            contentType: 'audio/mpeg',
          });
          
          // 计算音频时长
          const duration = Math.round((audioBuffer.length * 8) / (128 * 1000) * 1000);
          
          // 保存到数据库
          await supabase
            .from('lesson_sentence_audio')
            .insert({
              sentence_id: sentence.id,
              voice_id: voice.id,
              voice_name: voice.name,
              audio_url: audioKey,
              duration: duration,
            });
          
          generatedCount++;
          completedTasks++;
          sendProgress({
            type: 'progress',
            current: completedTasks,
            total: totalTasks,
            percent: Math.round((completedTasks / totalTasks) * 100),
            sentence_index: sentence.sentence_index,
            voice_name: voice.name,
            status: 'generated',
          });
          
          console.log(`生成音频: 课时${lessonId}, 句子${sentence.sentence_index}, 音色${voice.name}`);
          
        } catch (err: any) {
          failedCount++;
          completedTasks++;
          sendProgress({
            type: 'progress',
            current: completedTasks,
            total: totalTasks,
            percent: Math.round((completedTasks / totalTasks) * 100),
            sentence_index: sentence.sentence_index,
            voice_name: voice.name,
            status: 'failed',
            error: err.message,
          });
          console.error(`生成失败: 句子${sentence.sentence_index}, 音色${voice.id}`, err);
        }
      }
    }
    
    // 发送完成事件
    sendProgress({
      type: 'complete',
      generated: generatedCount,
      already_exists: alreadyExistsCount,
      failed: failedCount,
    });
    
    res.write('data: [DONE]\n\n');
  } catch (error: any) {
    console.error('生成音频失败:', error);
    sendProgress({ type: 'error', message: error.message });
    res.write('data: [DONE]\n\n');
  }
});

/**
 * PUT /api/v1/courses/lessons/sentences/:sentenceId
 * 更新句子文本（如果英文文本改变，自动翻译中文并重新生成音频）
 */
router.put('/lessons/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { sentenceId } = req.params;
    const { english_text, chinese_text, auto_translate = true } = req.body;
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const supabase = getSupabaseClient();
    
    if (!english_text && !chinese_text) {
      return res.status(400).json({ error: '请提供要更新的内容' });
    }
    
    // 先获取原句子
    const { data: oldSentence, error: fetchError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('id', sentenceId)
      .single();
    
    if (fetchError || !oldSentence) {
      return res.status(404).json({ error: '句子不存在' });
    }
    
    // 检查英文文本是否改变
    const englishChanged = english_text && english_text !== oldSentence.english_text;
    
    // 更新句子
    const updateData: { english_text?: string; chinese_text?: string } = {};
    if (english_text) updateData.english_text = english_text;
    
    // 如果英文改变了，且用户没有提供新的中文翻译，则自动翻译
    let translatedChinese = chinese_text;
    let autoTranslated = false;
    
    if (englishChanged && !chinese_text && auto_translate) {
      // 使用LLM自动翻译
      const config = new Config();
      const llmClient = new LLMClient(config, customHeaders);
      
      const messages = [
        { 
          role: 'system' as const, 
          content: `你是一个英语翻译助手。用户会给你一个英语句子，你需要翻译成中文。
要求：
1. 只返回中文翻译，不要其他解释
2. 翻译要准确、自然、流畅
3. 保持翻译简洁，适合英语学习者理解` 
        },
        { role: 'user' as const, content: english_text }
      ];

      const response = await llmClient.invoke(messages, { 
        temperature: 0.3,
        model: 'doubao-seed-1-6-lite-251015'
      });
      
      translatedChinese = response.content.trim();
      autoTranslated = true;
      updateData.chinese_text = translatedChinese;
      console.log(`自动翻译: "${english_text}" -> "${translatedChinese}"`);
    } else if (chinese_text) {
      updateData.chinese_text = chinese_text;
    }
    
    const { data: sentence, error } = await supabase
      .from('lesson_sentences')
      .update(updateData)
      .eq('id', sentenceId)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    
    // 如果英文文本改变，重新生成所有已存在的音色音频
    let regeneratedVoices: string[] = [];
    if (englishChanged) {
      // 获取该句子已存在的音频记录
      const { data: existingAudios } = await supabase
        .from('lesson_sentence_audio')
        .select('*')
        .eq('sentence_id', sentenceId);
      
      if (existingAudios && existingAudios.length > 0) {
        const config = new Config();
        const ttsClient = new TTSClient(config, customHeaders);
        
        for (const audio of existingAudios) {
          try {
            // 重新生成音频
            const ttsResponse = await ttsClient.synthesize({
              uid: `lesson_${sentence.lesson_id}`,
              text: english_text,
              speaker: audio.voice_id,
              audioFormat: 'mp3',
              sampleRate: 24000,
            });
            
            const audioResponse = await axios.get(ttsResponse.audioUri, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioResponse.data);
            
            // 上传新音频
            const audioKey = await storage.uploadFile({
              fileContent: audioBuffer,
              fileName: `lessons/${sentence.lesson_id}/sentence_${sentence.sentence_index}_${audio.voice_id}.mp3`,
              contentType: 'audio/mpeg',
            });
            
            const duration = Math.round((audioBuffer.length * 8) / (128 * 1000) * 1000);
            
            // 更新音频记录
            await supabase
              .from('lesson_sentence_audio')
              .update({
                audio_url: audioKey,
                duration: duration,
              })
              .eq('id', audio.id);
            
            regeneratedVoices.push(audio.voice_name);
            console.log(`重新生成音频: 句子${sentence.sentence_index}, 音色${audio.voice_name}`);
          } catch (err: any) {
            console.error(`重新生成音频失败: 音色${audio.voice_id}`, err);
          }
        }
      }
    }
    
    res.json({ 
      sentence, 
      regenerated_voices: regeneratedVoices,
      auto_translated: autoTranslated,
      chinese_text: translatedChinese
    });
  } catch (error: any) {
    console.error('更新句子失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/courses/lessons/sentences/:sentenceId
 * 删除句子（同时删除关联的音频记录）
 */
router.delete('/lessons/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { sentenceId } = req.params;
    const supabase = getSupabaseClient();
    
    // 先获取句子信息
    const { data: sentence, error: fetchError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('id', sentenceId)
      .single();
    
    if (fetchError || !sentence) {
      return res.status(404).json({ error: '句子不存在' });
    }
    
    const lessonId = sentence.lesson_id;
    const deletedIndex = sentence.sentence_index;
    
    // 删除关联的音频记录
    const { error: audioDeleteError } = await supabase
      .from('lesson_sentence_audio')
      .delete()
      .eq('sentence_id', sentenceId);
    
    if (audioDeleteError) {
      console.error('删除音频记录失败:', audioDeleteError);
    }
    
    // 删除句子
    const { error: deleteError } = await supabase
      .from('lesson_sentences')
      .delete()
      .eq('id', sentenceId);
    
    if (deleteError) {
      throw new Error(deleteError.message);
    }
    
    // 更新后续句子的序号（将所有大于删除序号的句子序号减1）
    const { error: updateError } = await supabase
      .rpc('decrement_sentence_index', {
        p_lesson_id: lessonId,
        p_deleted_index: deletedIndex
      });
    
    // 如果RPC不存在，使用直接更新
    if (updateError) {
      console.log('RPC不存在，使用直接更新方式');
      // 获取所有需要更新的句子
      const { data: sentencesToUpdate } = await supabase
        .from('lesson_sentences')
        .select('id, sentence_index')
        .eq('lesson_id', lessonId)
        .gt('sentence_index', deletedIndex);
      
      if (sentencesToUpdate && sentencesToUpdate.length > 0) {
        // 逐个更新序号
        for (const s of sentencesToUpdate) {
          await supabase
            .from('lesson_sentences')
            .update({ sentence_index: s.sentence_index - 1 })
            .eq('id', s.id);
        }
      }
    }
    
    // 更新课时的句子计数
    const { data: remainingSentences } = await supabase
      .from('lesson_sentences')
      .select('id')
      .eq('lesson_id', lessonId);
    
    await supabase
      .from('lessons')
      .update({ sentences_count: remainingSentences?.length || 0 })
      .eq('id', lessonId);
    
    res.json({ 
      success: true, 
      deleted_sentence_id: sentenceId,
      remaining_count: remainingSentences?.length || 0
    });
  } catch (error: any) {
    console.error('删除句子失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/courses/voices
 * 获取可用的音色列表
 */
router.get('/voices', (req: Request, res: Response) => {
  res.json({ voices: AVAILABLE_VOICES });
});

/**
 * GET /api/v1/courses/lessons/:lessonId/learnable
 * 获取可学习的课时数据
 */
router.get('/lessons/:lessonId/learnable', async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { voiceId } = req.query;
    const supabase = getSupabaseClient();
    
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();
    
    if (lessonError || !lesson) {
      return res.status(404).json({ error: '课时不存在' });
    }
    
    const { data: sentences, error: sentencesError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sentence_index', { ascending: true });
    
    if (sentencesError) {
      throw new Error(sentencesError.message);
    }
    
    const sentenceIds = (sentences || []).map(s => s.id);
    const targetVoiceId = voiceId || 'zh_female_xiaohe_uranus_bigtts';
    
    const { data: allAudios } = await supabase
      .from('lesson_sentence_audio')
      .select('*')
      .in('sentence_id', sentenceIds)
      .eq('voice_id', targetVoiceId);
    
    const audiosBySentence: Record<number, any> = {};
    (allAudios || []).forEach(audio => {
      audiosBySentence[audio.sentence_id] = audio;
    });
    
    const learnableSentences = [];
    let totalDuration = 0;
    
    for (const sentence of (sentences || [])) {
      const audio = audiosBySentence[sentence.id];
      if (audio) {
        const audioUrl = await storage.generatePresignedUrl({ 
          key: audio.audio_url, 
          expireTime: 86400 
        });
        
        totalDuration += audio.duration || 0;
        
        learnableSentences.push({
          id: sentence.id,
          text: sentence.english_text,
          chinese_text: sentence.chinese_text,
          sentence_index: sentence.sentence_index,
          start_time: 0,
          end_time: (audio.duration || 3000) / 1000,
          audio_url: audioUrl,
          audio_duration: audio.duration,
        });
      }
    }
    
    res.json({
      file: {
        id: parseInt(lessonId as string) * 10000,
        title: `${lesson.title} - ${lesson.description}`,
        original_audio_signed_url: null,
        original_duration: totalDuration,
        is_lesson: true,
        lesson_id: parseInt(lessonId as string),
        voice_id: targetVoiceId,
      },
      sentences: learnableSentences,
    });
  } catch (error: any) {
    console.error('获取可学习课时数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/courses/import-text
 * 通用文本导入接口（支持多种格式，使用 SSE 返回进度）
 * Body: { file_url?: string, file_key?: string, book_title: string, book_number: number, file_type: 'pdf' | 'docx' | 'txt' }
 * 
 * 支持的文件格式：PDF、Word(.docx)、纯文本(.txt)
 * 
 * 文本内容格式要求：
 * - 课程标题：如"新概念英语第三册"
 * - 课时标题：以 "Lesson X:" 或 "第X课:" 开头
 * - 句子内容：每行一个英文句子
 * - 空行分隔课时
 */

// 通用文本解析函数
async function parseFileContent(fileBuffer: Buffer, fileType: string): Promise<string> {
  if (fileType === 'pdf') {
    const pdfData = await pdfParse(fileBuffer);
    return pdfData.text;
  } else if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } else if (fileType === 'txt') {
    return fileBuffer.toString('utf-8');
  }
  throw new Error(`不支持的文件类型: ${fileType}`);
}

/**
 * POST /api/v1/courses/import-text
 * 通用文本导入接口（支持 PDF、Word、TXT，使用 SSE 返回进度）
 * Body: { file_url?: string, file_key?: string, book_title: string, book_number: number, file_type: 'pdf' | 'docx' | 'txt' }
 */
router.post('/import-text', async (req: Request, res: Response) => {
  const { file_url, file_key, book_title, book_number, file_type = 'pdf' } = req.body;
  const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
  
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  
  const sendProgress = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    let downloadUrl = file_url;
    
    if (!downloadUrl && file_key) {
      downloadUrl = await storage.generatePresignedUrl({ key: file_key, expireTime: 86400 });
      console.log(`[导入课程] 刷新URL成功: ${file_key}`);
    }
    
    if (!downloadUrl) {
      sendProgress({ type: 'error', message: '请提供文件 URL 或 key' });
      res.write('data: [DONE]\n\n');
      return;
    }
    
    console.log(`[导入课程] 开始下载: ${downloadUrl}, 类型: ${file_type}`);
    sendProgress({ type: 'progress', phase: 'downloading', message: '正在下载文件...', percent: 0 });
    
    const fileResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer', headers: customHeaders });
    const fileBuffer = Buffer.from(fileResponse.data);
    
    console.log(`[导入课程] 文件大小: ${fileBuffer.length} bytes`);
    sendProgress({ type: 'progress', phase: 'parsing', message: '正在解析文件...', percent: 10 });
    
    const textContent = await parseFileContent(fileBuffer, file_type);
    
    console.log(`[导入课程] 文本长度: ${textContent.length}`);
    sendProgress({ type: 'progress', phase: 'parsing', message: '文件解析完成', percent: 20 });
    
    // 解析课程结构（复用 import-pdf 的逻辑，支持 AI 智能识别）
    const lessons = await parseNCEText(textContent);
    console.log(`[导入课程] 解析到 ${lessons.length} 个课时`);
    sendProgress({ type: 'progress', phase: 'importing', message: `解析到 ${lessons.length} 个课时，开始导入...`, percent: 25 });
    
    // 导入到数据库（复用 import-pdf 的逻辑）
    const supabase = getSupabaseClient();
    
    let { data: existingCourse } = await supabase.from('courses').select('*').eq('book_number', book_number).single();
    let courseId: number;
    
    if (existingCourse) {
      courseId = existingCourse.id;
      console.log(`[导入课程] 找到已存在课程: ${book_title} (ID: ${courseId}, book_number: ${book_number})`);
    } else {
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({ title: book_title, book_number, description: `${book_title} - 共 ${lessons.length} 课`, total_lessons: lessons.length })
        .select().single();
      
      if (courseError) throw new Error(courseError.message);
      courseId = newCourse.id;
      console.log(`[导入课程] 创建新课程: ${book_title} (ID: ${courseId}, book_number: ${book_number})`);
    }
    
    // 无论新旧课程，都清除该课程下的所有旧数据（确保不会冲突）
    sendProgress({ type: 'progress', phase: 'importing', message: '正在清除旧数据...', percent: 30 });
    
    const { data: existingLessons } = await supabase.from('lessons').select('id').eq('course_id', courseId);
    if (existingLessons && existingLessons.length > 0) {
      console.log(`[导入课程] 清除 ${existingLessons.length} 个旧课时...`);
      const lessonIds = existingLessons.map(l => l.id);
      const { data: existingSentences } = await supabase.from('lesson_sentences').select('id').in('lesson_id', lessonIds);
      if (existingSentences && existingSentences.length > 0) {
        const sentenceIds = existingSentences.map(s => s.id);
        await supabase.from('lesson_sentence_audio').delete().in('sentence_id', sentenceIds);
      }
      await supabase.from('lesson_sentences').delete().in('lesson_id', lessonIds);
      await supabase.from('lessons').delete().eq('course_id', courseId);
      console.log(`[导入课程] 旧数据已清除`);
    }
    sendProgress({ type: 'progress', phase: 'importing', message: '旧数据已清除，开始导入课时...', percent: 35 });
    
    // 导入课时和句子
    let totalSentences = 0;
    const basePercent = 35;
    const percentRange = 60;
    
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const percent = basePercent + Math.round((i / lessons.length) * percentRange);
      sendProgress({ type: 'progress', phase: 'importing', message: `正在导入第 ${lesson.lesson_number} 课: ${lesson.title}`, percent });
      
      const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .insert({ course_id: courseId, lesson_number: lesson.lesson_number, title: lesson.title, description: lesson.description || '', sentences_count: lesson.sentences.length })
        .select().single();
      
      if (lessonError) throw new Error(lessonError.message);
      
      if (lesson.sentences.length > 0) {
        const sentencesData = lesson.sentences.map((s, idx) => ({
          lesson_id: lessonData.id,
          sentence_index: idx + 1,
          english_text: s.english,
          chinese_text: s.chinese || null,
        }));
        
        const { error: sentencesError } = await supabase.from('lesson_sentences').insert(sentencesData);
        if (sentencesError) throw new Error(sentencesError.message);
        
        totalSentences += lesson.sentences.length;
      }
    }
    
    // 更新课程统计
    await supabase.from('courses').update({ total_lessons: lessons.length }).eq('id', courseId);
    
    sendProgress({ type: 'complete', message: `导入完成！共 ${lessons.length} 课，${totalSentences} 个句子` });
    res.write('data: [DONE]\n\n');
    
  } catch (error: any) {
    console.error('[导入课程] 失败:', error);
    sendProgress({ type: 'error', message: error.message || '导入失败' });
    res.write('data: [DONE]\n\n');
  }
});

/**
 * POST /api/v1/courses/import-pdf
 * 从 PDF 导入课程数据（使用 SSE 返回进度）
 * Body: { pdf_url?: string, pdf_key?: string, book_title: string, book_number: number }
 * 
 * pdf_url 和 pdf_key 二选一，如果提供 pdf_key，会自动刷新签名URL
 * 
 * PDF 内容格式要求：
 * 新概念英语第三册
 * Lesson 1: A puma at large
 * 句子内容...
 * Lesson 2: ...
 */
router.post('/import-pdf', async (req: Request, res: Response) => {
  const { pdf_url, pdf_key, book_title, book_number } = req.body;
  const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  
  const sendProgress = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    let downloadUrl = pdf_url;
    
    // 如果提供了 pdf_key，刷新签名URL
    if (!downloadUrl && pdf_key) {
      const { S3Storage } = await import('coze-coding-dev-sdk');
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      });
      downloadUrl = await storage.generatePresignedUrl({
        key: pdf_key,
        expireTime: 86400,
      });
      console.log(`[导入课程] 刷新URL成功: ${pdf_key}`);
    }
    
    if (!downloadUrl) {
      sendProgress({ type: 'error', message: 'PDF URL or key is required' });
      res.write('data: [DONE]\n\n');
      return;
    }
    
    console.log(`[导入课程] 开始解析 PDF: ${downloadUrl}`);
    sendProgress({ type: 'progress', phase: 'downloading', message: '正在下载 PDF 文件...', percent: 0 });
    
    // 先下载 PDF 文件，然后用 pdf-parse 解析
    const pdfResponse = await axios.get(downloadUrl, { 
      responseType: 'arraybuffer',
      headers: customHeaders
    });
    
    const pdfBuffer = Buffer.from(pdfResponse.data);
    console.log(`[导入课程] PDF 文件大小: ${pdfBuffer.length} bytes`);
    sendProgress({ type: 'progress', phase: 'parsing', message: '正在解析 PDF 内容...', percent: 10 });
    
    // 使用 pdf-parse 解析
    const pdfData = await pdfParse(pdfBuffer);
    const textContent = pdfData.text;
    
    console.log(`[导入课程] PDF 文本长度: ${textContent.length}, 页数: ${pdfData.numpages}`);
    sendProgress({ type: 'progress', phase: 'parsing', message: `PDF 解析完成，共 ${pdfData.numpages} 页`, percent: 20 });
    
    // 解析课程结构（支持 AI 智能识别）
    const lessons = await parseNCEText(textContent);
    console.log(`[导入课程] 解析到 ${lessons.length} 个课时`);
    sendProgress({ type: 'progress', phase: 'importing', message: `解析到 ${lessons.length} 个课时，开始导入...`, percent: 25 });
    
    const supabase = getSupabaseClient();
    
    // 查找或创建课程
    let { data: existingCourse } = await supabase
      .from('courses')
      .select('*')
      .eq('book_number', book_number)
      .single();
    
    let courseId: number;
    
    if (existingCourse) {
      courseId = existingCourse.id;
      console.log(`[导入课程] 使用现有课程: ${existingCourse.title} (ID: ${courseId}, book_number: ${book_number})`);
    } else {
      // 创建新课程
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          title: book_title,
          book_number: book_number,
          description: `${book_title} - 共 ${lessons.length} 课`,
          total_lessons: lessons.length,
        })
        .select()
        .single();
      
      if (courseError) {
        throw new Error(courseError.message);
      }
      courseId = newCourse.id;
      console.log(`[导入课程] 创建新课程: ${book_title} (ID: ${courseId}, book_number: ${book_number})`);
    }
    
    // 无论新旧课程，都清除该课程下的所有旧数据（确保不会冲突）
    sendProgress({ type: 'progress', phase: 'importing', message: '正在清除旧数据...', percent: 30 });
    
    const { data: existingLessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId);
    
    if (existingLessons && existingLessons.length > 0) {
      console.log(`[导入课程] 清除 ${existingLessons.length} 个旧课时...`);
      const lessonIds = existingLessons.map(l => l.id);
      
      // 删除句子音频
      const { data: existingSentences } = await supabase
        .from('lesson_sentences')
        .select('id')
        .in('lesson_id', lessonIds);
      
      if (existingSentences && existingSentences.length > 0) {
        const sentenceIds = existingSentences.map(s => s.id);
        await supabase
          .from('lesson_sentence_audio')
          .delete()
          .in('sentence_id', sentenceIds);
      }
      
      // 删除句子
      await supabase
        .from('lesson_sentences')
        .delete()
        .in('lesson_id', lessonIds);
      
      // 删除课时
      await supabase
        .from('lessons')
        .delete()
        .eq('course_id', courseId);
      
      console.log(`[导入课程] 旧数据已清除`);
    }
    sendProgress({ type: 'progress', phase: 'importing', message: '旧数据已清除，开始导入课时...', percent: 35 });
    
    // 导入课时和句子
    let totalSentences = 0;
    const basePercent = 35;
    const percentRange = 60; // 35% - 95% 用于导入课时
    
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const lessonPercent = basePercent + Math.round((i / lessons.length) * percentRange);
      sendProgress({ 
        type: 'progress', 
        phase: 'importing', 
        message: `正在导入 Lesson ${lesson.lesson_number}: ${lesson.title} (${i + 1}/${lessons.length})`, 
        percent: lessonPercent,
        current_lesson: i + 1,
        total_lessons: lessons.length
      });
      
      // 创建课时
      const { data: newLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          course_id: courseId,
          lesson_number: lesson.lesson_number,
          title: lesson.title,
          description: lesson.description || `Lesson ${lesson.lesson_number}`,
          sentences_count: lesson.sentences.length,
        })
        .select()
        .single();
      
      if (lessonError) {
        console.error(`[导入课程] 创建课时失败: Lesson ${lesson.lesson_number}`, lessonError);
        continue;
      }
      
      // 创建句子
      if (lesson.sentences.length > 0) {
        const sentenceRecords = lesson.sentences.map((sentence, index) => ({
          lesson_id: newLesson.id,
          sentence_index: index + 1,
          english_text: sentence.english,
          chinese_text: sentence.chinese || '',
        }));
        
        const { error: sentencesError } = await supabase
          .from('lesson_sentences')
          .insert(sentenceRecords);
        
        if (sentencesError) {
          console.error(`[导入课程] 创建句子失败: Lesson ${lesson.lesson_number}`, sentencesError);
        } else {
          totalSentences += lesson.sentences.length;
        }
      }
    }
    
    // 更新课程的课时数量
    await supabase
      .from('courses')
      .update({ 
        total_lessons: lessons.length,
        description: `${book_title} - 共 ${lessons.length} 课`,
      })
      .eq('id', courseId);
    
    sendProgress({ 
      type: 'complete', 
      message: `导入成功：${book_title}，共 ${lessons.length} 课，${totalSentences} 个句子`,
      course_id: courseId,
      lessons_count: lessons.length,
      sentences_count: totalSentences,
      percent: 100
    });
    
    console.log(`[导入课程] 导入成功: ${lessons.length} 课, ${totalSentences} 个句子`);
    res.write('data: [DONE]\n\n');
    res.end();
    
  } catch (error) {
    console.error('[导入课程] 错误:', error);
    sendProgress({ type: 'error', message: error instanceof Error ? error.message : '导入失败' });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * 解析课程文本（支持多种格式）
 * 首先尝试使用正则匹配，如果失败则使用 AI 智能识别
 * 支持格式：
 * - Lesson 1: A puma at large
 * - Unit 1: Title
 * - Starter Unit: Title
 * - Part 1: Title
 * - Chapter 1: Title
 */
async function parseNCEText(text: string): Promise<Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}>> {
  const lessons: Array<{
    lesson_number: number;
    title: string;
    description?: string;
    sentences: Array<{ english: string; chinese?: string }>;
  }> = [];
  
  // 打印文本预览，帮助调试
  console.log(`[解析] 文本预览 (前500字符):\n${text.substring(0, 500)}`);
  console.log(`[解析] 文本预览 (500-1000字符):\n${text.substring(500, 1000)}`);
  
  // 特别打印第38-40课附近的内容
  const lesson38Index = text.search(/Lesson\s+38/i);
  const lesson40Index = text.search(/Lesson\s+40/i);
  if (lesson38Index !== -1) {
    console.log(`[解析] 第38课附近内容:\n${text.substring(lesson38Index, lesson38Index + 500)}`);
  }
  if (lesson40Index !== -1) {
    console.log(`[解析] 第40课附近内容:\n${text.substring(Math.max(0, lesson40Index - 500), lesson40Index + 200)}`);
  }
  
  // 打印所有包含 "39" 的行
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (/39/.test(line)) {
      // 打印这一行及其前后两行
      console.log(`[解析] 包含39的行 ${idx}: |${line}|`);
      if (idx > 0) console.log(`[解析]   前一行 ${idx-1}: |${lines[idx-1]}|`);
      if (idx < lines.length - 1) console.log(`[解析]   后一行 ${idx+1}: |${lines[idx+1]}|`);
    }
  });
  
  // 特别检查 Lesson 39 的格式
  const lesson39Match = text.match(/Lesson\s*39[:\s]*(.*?)(?:\n|$)/i);
  if (lesson39Match) {
    console.log(`[解析] Lesson 39 匹配结果: |${lesson39Match[0]}|`);
  } else {
    console.log(`[解析] Lesson 39 未匹配到`);
    // 查找原始文本中 Lesson 39 附近的内容
    const idx = text.indexOf('Lesson 39');
    if (idx !== -1) {
      console.log(`[解析] Lesson 39 原始位置 ${idx}, 内容: |${text.substring(idx, idx + 50)}|`);
    }
  }
  
  // 匹配 Lesson 标题的正则 - 支持多种格式
  // 格式1: Lesson 1: A puma at large
  // 格式2: Lesson 1 A puma at large
  // 格式3: Lesson  1: A puma at large (多空格)
  // 使用 matchAll 代替 exec 循环，更可靠
  const lessonRegex = /Lesson\s+(\d+)[:\s]+([^\n]+)/gi;
  
  const allMatches = [...text.matchAll(lessonRegex)];
  const matches: Array<{ index: number; lesson_number: number; title: string }> = allMatches.map(m => ({
    index: m.index!,
    lesson_number: parseInt(m[1], 10),
    title: m[2].trim(),
  }));
  
  // 打印匹配结果数量
  console.log(`[解析] 正则匹配到 ${matches.length} 个课时标题`);
  
  // 检查是否有重复的课时号
  const lessonNumbers = matches.map(m => m.lesson_number);
  const uniqueLessonNumbers = [...new Set(lessonNumbers)];
  if (lessonNumbers.length !== uniqueLessonNumbers.length) {
    console.log(`[解析] 警告：检测到重复的课时号，原始数量: ${lessonNumbers.length}, 唯一数量: ${uniqueLessonNumbers.length}`);
    // 去重，保留第一个匹配
    const seen = new Set<number>();
    const uniqueMatches: typeof matches = [];
    for (const m of matches) {
      if (!seen.has(m.lesson_number)) {
        seen.add(m.lesson_number);
        uniqueMatches.push(m);
      }
    }
    matches.length = 0;
    matches.push(...uniqueMatches);
    console.log(`[解析] 去重后课时数量: ${matches.length}`);
  }
  
  console.log(`[解析] 课时列表: ${matches.map(m => `Lesson ${m.lesson_number}: ${m.title}`).join(', ')}`);
  
  // 如果正则匹配失败或匹配结果太少，尝试使用 AI 智能识别
  if (matches.length === 0) {
    console.log(`[解析] 正则未匹配到课时，尝试使用 AI 智能识别...`);
    try {
      const aiLessons = await parseLessonsWithAI(text);
      if (aiLessons.length > 0) {
        console.log(`[解析] AI 智能识别成功，返回 ${aiLessons.length} 个课时`);
        return aiLessons;
      }
    } catch (aiError) {
      console.error('[解析] AI 智能识别失败:', aiError);
    }
    // AI 也失败了，返回空数组
    return [];
  }
  
  // 按课时分割文本
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];
    
    const startIndex = currentMatch.index + `Lesson ${currentMatch.lesson_number}`.length + currentMatch.title.length + 2;
    const endIndex = nextMatch ? nextMatch.index : text.length;
    
    const lessonContent = text.substring(startIndex, endIndex).trim();
    
    // 解析句子
    const sentences = parseSentences(lessonContent);
    
    lessons.push({
      lesson_number: currentMatch.lesson_number,
      title: currentMatch.title,
      description: currentMatch.title,
      sentences,
    });
  }
  
  return lessons;
}

/**
 * 解析句子内容
 * 支持格式：一行英文 + 一行中文翻译
 * 
 * 解析逻辑：
 * 1. 按行分割内容
 * 2. 识别每一行是英文还是中文（根据是否包含中文字符）
 * 3. 将英文行和紧随的中文行配对成一个句子
 * 4. 处理跨行的情况（英文或中文可能跨越多行）
 */
function parseSentences(content: string): Array<{ english: string; chinese?: string }> {
  const sentences: Array<{ english: string; chinese?: string }> = [];
  
  // 按行分割，保留所有非空行
  const allLines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  console.log(`[解析句子] 共 ${allLines.length} 行`);
  
  // 分析每一行的类型
  interface LineInfo {
    text: string;
    type: 'english' | 'chinese' | 'mixed' | 'unknown';
    isComplete: boolean; // 是否是完整句子（以标点结尾）
  }
  
  const lineInfos: LineInfo[] = allLines.map(line => {
    // 统计中文字符比例
    const chineseChars = (line.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (line.match(/[a-zA-Z]/g) || []).length;
    const totalChars = chineseChars + englishChars;
    
    let type: 'english' | 'chinese' | 'mixed' | 'unknown';
    if (totalChars === 0) {
      type = 'unknown';
    } else if (chineseChars > englishChars * 2) {
      type = 'chinese';
    } else if (englishChars > chineseChars * 2) {
      type = 'english';
    } else if (chineseChars > 0 && englishChars > 0) {
      type = 'mixed';
    } else if (chineseChars > 0) {
      type = 'chinese';
    } else if (englishChars > 0) {
      type = 'english';
    } else {
      type = 'unknown';
    }
    
    // 检查是否是完整句子
    const isComplete = /[.!?。！？]$/.test(line);
    
    return { text: line, type, isComplete };
  });
  
  // 打印前20行的分析结果
  console.log(`[解析句子] 行分析结果（前20行）:`);
  lineInfos.slice(0, 20).forEach((info, idx) => {
    console.log(`  ${idx + 1}: [${info.type}] ${info.isComplete ? '✓' : '...'} ${info.text.substring(0, 50)}...`);
  });
  
  // 配对句子：一行英文 + 一行中文
  let i = 0;
  while (i < lineInfos.length) {
    const currentLine = lineInfos[i];
    
    // 跳过中文行（应该作为上一句的翻译）
    if (currentLine.type === 'chinese') {
      i++;
      continue;
    }
    
    // 如果是英文行或混合行，收集英文内容
    let englishText = '';
    let chineseText = '';
    
    // 收集连续的英文行（直到遇到中文行或完整句子）
    while (i < lineInfos.length) {
      const line = lineInfos[i];
      
      if (line.type === 'chinese') {
        // 遇到中文行，开始收集中文翻译
        break;
      }
      
      if (englishText) {
        englishText += ' ' + line.text;
      } else {
        englishText = line.text;
      }
      
      i++;
      
      // 如果当前行以英文标点结尾，可能是完整句子
      if (line.isComplete && line.type === 'english') {
        break;
      }
    }
    
    // 收集连续的中文行
    while (i < lineInfos.length && lineInfos[i].type === 'chinese') {
      const line = lineInfos[i];
      if (chineseText) {
        chineseText += line.text;
      } else {
        chineseText = line.text;
      }
      i++;
    }
    
    // 清理文本并添加句子
    englishText = englishText.trim();
    chineseText = chineseText.trim();
    
    // 跳过空句子或太短的句子
    if (englishText && englishText.length > 3) {
      sentences.push({ 
        english: englishText, 
        chinese: chineseText || undefined 
      });
    }
  }
  
  console.log(`[解析句子] 解析出 ${sentences.length} 个句子`);
  
  // 打印前5个句子
  sentences.slice(0, 5).forEach((s, idx) => {
    console.log(`  句子${idx + 1}: ${s.english.substring(0, 40)}... -> ${s.chinese?.substring(0, 20) || '无翻译'}...`);
  });
  
  return sentences;
}

export default router;
