import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { TTSClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import axios from 'axios';

const router = Router();

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 定义可用的音色
const AVAILABLE_VOICES = [
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '晓荷', gender: 'female', style: 'general' },
  { id: 'zh_female_vv_uranus_bigtts', name: '薇薇', gender: 'female', style: 'bilingual' },
  { id: 'zh_male_m191_uranus_bigtts', name: '云舟', gender: 'male', style: 'general' },
  { id: 'zh_male_taocheng_uranus_bigtts', name: '晓天', gender: 'male', style: 'general' },
  { id: 'zh_female_xueayi_saturn_bigtts', name: '雪阿姨', gender: 'female', style: 'audiobook' },
  { id: 'zh_male_dayi_saturn_bigtts', name: '大义', gender: 'male', style: 'video' },
];

/**
 * GET /api/v1/courses
 * 获取课程列表
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
    
    res.json({ courses });
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
    const { voiceId } = req.query; // 可选：指定音色
    const supabase = getSupabaseClient();
    
    // 获取课时信息
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();
    
    if (lessonError || !lesson) {
      return res.status(404).json({ error: '课时不存在' });
    }
    
    // 获取句子列表
    const { data: sentences, error: sentencesError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('sentence_index', { ascending: true });
    
    if (sentencesError) {
      throw new Error(sentencesError.message);
    }
    
    // 批量获取所有句子的音频（一次数据库查询）
    const sentenceIds = (sentences || []).map(s => s.id);
    const { data: allAudios } = await supabase
      .from('lesson_sentence_audio')
      .select('*')
      .in('sentence_id', sentenceIds);
    
    // 按句子ID分组
    const audiosBySentence: Record<number, any[]> = {};
    (allAudios || []).forEach(audio => {
      if (!audiosBySentence[audio.sentence_id]) {
        audiosBySentence[audio.sentence_id] = [];
      }
      audiosBySentence[audio.sentence_id].push(audio);
    });
    
    // 批量生成签名URL（并行）
    const sentencesWithAudio = await Promise.all(
      (sentences || []).map(async (sentence) => {
        const audios = audiosBySentence[sentence.id] || [];
        
        // 筛选指定音色的音频
        let targetAudio = audios[0];
        if (voiceId) {
          targetAudio = audios.find(a => a.voice_id === voiceId) || null;
        }
        
        let audioUrl = null;
        let duration = null;
        let availableVoices: string[] = [];
        
        if (targetAudio) {
          // 获取签名URL
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
 * 获取指定句子的音频（支持不同音色）
 */
router.get('/lessons/:lessonId/sentences/:sentenceIndex/audio', async (req: Request, res: Response) => {
  try {
    const { lessonId, sentenceIndex } = req.params;
    const { voiceId = 'zh_female_xiaohe_uranus_bigtts' } = req.query;
    const supabase = getSupabaseClient();
    
    // 获取句子
    const { data: sentence, error: sentenceError } = await supabase
      .from('lesson_sentences')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('sentence_index', sentenceIndex)
      .single();
    
    if (sentenceError || !sentence) {
      return res.status(404).json({ error: '句子不存在' });
    }
    
    // 查询音频
    const { data: audio, error: audioError } = await supabase
      .from('lesson_sentence_audio')
      .select('*')
      .eq('sentence_id', sentence.id)
      .eq('voice_id', voiceId)
      .single();
    
    if (audioError || !audio) {
      return res.status(404).json({ error: '该音色的音频尚未生成' });
    }
    
    // 获取签名URL
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
 * 创建新课程（管理员功能）
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
 * 创建新课时（管理员功能）
 */
router.post('/:courseId/lessons', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { lesson_number, title, description, sentences } = req.body;
    const supabase = getSupabaseClient();
    
    // 创建课时
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .insert({
        course_id: parseInt(courseId),
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
    
    // 创建句子
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
    
    // 更新课程的课时数
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
 * 为指定课时的所有句子生成AI语音
 */
router.post('/lessons/:lessonId/generate-audio', async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { voiceIds } = req.body; // 要生成的音色ID列表，默认生成所有
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    
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
      return res.status(400).json({ error: '课时没有句子' });
    }
    
    // 确定要生成的音色
    const voicesToGenerate = voiceIds && voiceIds.length > 0 
      ? AVAILABLE_VOICES.filter(v => voiceIds.includes(v.id))
      : AVAILABLE_VOICES;
    
    if (voicesToGenerate.length === 0) {
      return res.status(400).json({ error: '没有有效的音色' });
    }
    
    const results: any[] = [];
    
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
            results.push({
              sentence_index: sentence.sentence_index,
              voice_id: voice.id,
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
          
          // 计算音频时长（估算：mp3比特率约128kbps）
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
          
          results.push({
            sentence_index: sentence.sentence_index,
            voice_id: voice.id,
            status: 'generated',
            audio_key: audioKey,
          });
          
          console.log(`生成音频: 课时${lessonId}, 句子${sentence.sentence_index}, 音色${voice.name}`);
          
        } catch (err: any) {
          console.error(`生成失败: 句子${sentence.sentence_index}, 音色${voice.id}`, err);
          results.push({
            sentence_index: sentence.sentence_index,
            voice_id: voice.id,
            status: 'failed',
            error: err.message,
          });
        }
      }
    }
    
    res.json({ 
      success: true,
      generated: results.filter(r => r.status === 'generated').length,
      already_exists: results.filter(r => r.status === 'already_exists').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    });
  } catch (error: any) {
    console.error('生成音频失败:', error);
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

export default router;
