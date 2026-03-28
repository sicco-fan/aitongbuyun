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
 * 更新句子文本（如果英文文本改变，自动重新生成音频）
 */
router.put('/lessons/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const { sentenceId } = req.params;
    const { english_text, chinese_text } = req.body;
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
    if (chinese_text) updateData.chinese_text = chinese_text;
    
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
    
    res.json({ sentence, regenerated_voices: regeneratedVoices });
  } catch (error: any) {
    console.error('更新句子失败:', error);
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

export default router;
