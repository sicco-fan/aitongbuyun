import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { TTSClient, Config, HeaderUtils, S3Storage, LLMClient, FetchClient } from 'coze-coding-dev-sdk';
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
 * POST /api/v1/courses/import-pdf
 * 从 PDF 导入课程数据
 * Body: { pdf_url: string, book_title: string, book_number: number }
 * 
 * PDF 内容格式要求：
 * 新概念英语第三册
 * Lesson 1: A puma at large
 * 句子内容...
 * Lesson 2: ...
 */
router.post('/import-pdf', async (req: Request, res: Response) => {
  try {
    const { pdf_url, book_title, book_number } = req.body;
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    
    if (!pdf_url) {
      return res.status(400).json({ error: 'PDF URL is required' });
    }
    
    console.log(`[导入课程] 开始解析 PDF: ${pdf_url}`);
    
    // 使用 FetchClient 解析 PDF
    const config = new Config();
    const fetchClient = new FetchClient(config, customHeaders);
    
    const response = await fetchClient.fetch(pdf_url);
    
    if (response.status_code !== 0) {
      return res.status(400).json({ error: response.status_message || 'PDF 解析失败' });
    }
    
    // 提取文本内容
    const textContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    
    console.log(`[导入课程] PDF 文本长度: ${textContent.length}`);
    
    // 解析课程结构
    const lessons = parseNCEText(textContent);
    console.log(`[导入课程] 解析到 ${lessons.length} 个课时`);
    
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
      console.log(`[导入课程] 使用现有课程: ${existingCourse.title} (ID: ${courseId})`);
      
      // 删除现有的课时和句子
      const { data: existingLessons } = await supabase
        .from('lessons')
        .select('id')
        .eq('course_id', courseId);
      
      if (existingLessons && existingLessons.length > 0) {
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
          .in('id', lessonIds);
      }
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
      console.log(`[导入课程] 创建新课程: ${book_title} (ID: ${courseId})`);
    }
    
    // 导入课时和句子
    let totalSentences = 0;
    
    for (const lesson of lessons) {
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
    
    res.json({
      success: true,
      message: `导入成功：${book_title}，共 ${lessons.length} 课，${totalSentences} 个句子`,
      course_id: courseId,
      lessons_count: lessons.length,
      sentences_count: totalSentences,
    });
    
  } catch (error: any) {
    console.error('导入课程失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 解析新概念英语文本
 * 格式：
 * Lesson 1: A puma at large
 * 句子内容（英文）
 * ...
 */
function parseNCEText(text: string): Array<{
  lesson_number: number;
  title: string;
  description?: string;
  sentences: Array<{ english: string; chinese?: string }>;
}> {
  const lessons: Array<{
    lesson_number: number;
    title: string;
    description?: string;
    sentences: Array<{ english: string; chinese?: string }>;
  }> = [];
  
  // 匹配 Lesson 标题的正则
  const lessonRegex = /Lesson\s+(\d+)[:：]\s*(.+?)(?:\n|$)/gi;
  
  let match;
  let lastIndex = 0;
  const matches: Array<{ index: number; lesson_number: number; title: string }> = [];
  
  while ((match = lessonRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      lesson_number: parseInt(match[1], 10),
      title: match[2].trim(),
    });
  }
  
  // 按课时分割文本
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];
    
    const startIndex = currentMatch.index + `Lesson ${currentMatch.lesson_number}:`.length + currentMatch.title.length + 1;
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
 * 支持多种格式：
 * 1. 纯英文句子，按句号分割
 * 2. 英文 + 中文翻译格式
 */
function parseSentences(content: string): Array<{ english: string; chinese?: string }> {
  const sentences: Array<{ english: string; chinese?: string }> = [];
  
  // 按段落分割
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 跳过空行和标题行
      if (!trimmedLine || /^Lesson\s+\d+/i.test(trimmedLine)) {
        continue;
      }
      
      // 尝试匹配英文+中文格式（中文可能在同一行或下一行）
      // 格式1: 英文句子 [中文翻译]
      // 格式2: 英文句子
      //        中文翻译
      
      // 检查是否包含中文字符
      const chineseMatch = trimmedLine.match(/[\u4e00-\u9fa5]+/);
      
      if (chineseMatch) {
        // 包含中文，尝试分离英文和中文
        const chineseIndex = trimmedLine.search(/[\u4e00-\u9fa5]/);
        const englishPart = trimmedLine.substring(0, chineseIndex).trim();
        const chinesePart = trimmedLine.substring(chineseIndex).trim();
        
        if (englishPart) {
          sentences.push({ english: englishPart, chinese: chinesePart });
        }
      } else {
        // 纯英文句子
        // 按句号、问号、感叹号分割成独立句子
        const sentenceMatches = trimmedLine.match(/[^.!?]*[.!?]+/g);
        if (sentenceMatches) {
          for (const s of sentenceMatches) {
            const cleanSentence = s.trim();
            if (cleanSentence && cleanSentence.length > 3) {
              sentences.push({ english: cleanSentence });
            }
          }
        } else if (trimmedLine.length > 3) {
          sentences.push({ english: trimmedLine });
        }
      }
    }
  }
  
  return sentences;
}

export default router;
