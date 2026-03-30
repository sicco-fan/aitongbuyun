import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { TTSClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';
import axios from 'axios';

const router = express.Router();

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 可用音色列表（只使用一个默认音色）
const DEFAULT_VOICE = {
  id: 'zh_female_xiaohe_uranus_bigtts',
  name: '小何',
};

/**
 * 后台任务执行器
 * 使用 setImmediate 模拟后台执行，不阻塞 HTTP 响应
 */
async function executeGenerateCourseAudio(
  taskId: number, 
  courseId: number, 
  courseTitle: string,
  headers: Record<string, string>
) {
  const client = getSupabaseClient();
  const config = new Config();
  const ttsClient = new TTSClient(config, headers);
  
  try {
    // 更新任务状态为运行中
    await client
      .from('background_tasks')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', taskId);
    
    // 获取课程下所有课时
    const { data: lessons, error: lessonsError } = await client
      .from('lessons')
      .select('id, title, lesson_number')
      .eq('course_id', courseId)
      .order('lesson_number', { ascending: true });
    
    if (lessonsError) throw lessonsError;
    
    if (!lessons || lessons.length === 0) {
      await client
        .from('background_tasks')
        .update({ 
          status: 'completed', 
          progress: 100,
          result: JSON.stringify({ message: '没有需要处理的课时' }),
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);
      return;
    }
    
    // 获取所有课时的句子
    const lessonIds = lessons.map(l => l.id);
    const { data: allSentences, error: sentencesError } = await client
      .from('lesson_sentences')
      .select('id, lesson_id, sentence_index, english_text')
      .in('lesson_id', lessonIds)
      .order('sentence_index', { ascending: true });
    
    if (sentencesError) throw sentencesError;
    
    if (!allSentences || allSentences.length === 0) {
      await client
        .from('background_tasks')
        .update({ 
          status: 'completed', 
          progress: 100,
          result: JSON.stringify({ message: '没有需要处理的句子' }),
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);
      return;
    }
    
    // 更新总数（按句子数计算）
    await client
      .from('background_tasks')
      .update({ 
        total: allSentences.length, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);
    
    // 检查哪些句子已经有音频
    const sentenceIds = allSentences.map(s => s.id);
    const { data: existingAudios } = await client
      .from('lesson_sentence_audio')
      .select('sentence_id')
      .in('sentence_id', sentenceIds)
      .eq('voice_id', DEFAULT_VOICE.id);
    
    const existingSentenceIds = new Set(existingAudios?.map(a => a.sentence_id) || []);
    
    let completedCount = 0;
    let generatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    // 检查任务是否被取消
    const checkCancelled = async () => {
      const { data: task } = await client
        .from('background_tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      return task?.status === 'cancelled';
    };
    
    // 逐个处理句子
    for (const sentence of allSentences) {
      // 检查是否被取消
      if (await checkCancelled()) {
        console.log(`[后台任务] 任务被取消: ${taskId}`);
        return;
      }
      
      try {
        // 检查是否已有音频
        if (existingSentenceIds.has(sentence.id)) {
          skippedCount++;
          completedCount++;
          
          const progress = Math.round((completedCount / allSentences.length) * 100);
          await client
            .from('background_tasks')
            .update({ 
              progress, 
              completed_count: completedCount,
              updated_at: new Date().toISOString() 
            })
            .eq('id', taskId);
          continue;
        }
        
        // 调用 TTS 生成音频
        const ttsResponse = await ttsClient.synthesize({
          uid: `course_${courseId}`,
          text: sentence.english_text,
          speaker: DEFAULT_VOICE.id,
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
          fileName: `courses/${courseId}/lessons/${sentence.lesson_id}/sentence_${sentence.sentence_index}_${DEFAULT_VOICE.id}.mp3`,
          contentType: 'audio/mpeg',
        });
        
        // 计算音频时长
        const duration = Math.round((audioBuffer.length * 8) / (128 * 1000) * 1000);
        
        // 保存到数据库
        await client
          .from('lesson_sentence_audio')
          .insert({
            sentence_id: sentence.id,
            voice_id: DEFAULT_VOICE.id,
            voice_name: DEFAULT_VOICE.name,
            audio_url: audioKey,
            duration: duration,
          });
        
        generatedCount++;
        
      } catch (err: any) {
        console.error(`[后台任务] 生成音频失败: sentence ${sentence.id}`, err.message);
        failedCount++;
      }
      
      completedCount++;
      const progress = Math.round((completedCount / allSentences.length) * 100);
      
      // 更新进度
      await client
        .from('background_tasks')
        .update({ 
          progress, 
          completed_count: completedCount,
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);
    }
    
    // 任务完成
    await client
      .from('background_tasks')
      .update({ 
        status: 'completed', 
        progress: 100,
        completed_count: completedCount,
        result: JSON.stringify({ 
          message: `处理完成`,
          total: allSentences.length,
          generated: generatedCount,
          skipped: skippedCount,
          failed: failedCount,
        }),
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);
    
    console.log(`[后台任务] 课程音频生成完成: ${courseTitle}, 任务ID: ${taskId}, 生成: ${generatedCount}, 跳过: ${skippedCount}, 失败: ${failedCount}`);
    
  } catch (error: any) {
    console.error(`[后台任务] 执行失败:`, error);
    await client
      .from('background_tasks')
      .update({ 
        status: 'failed', 
        error_message: error?.message || '执行失败',
        updated_at: new Date().toISOString() 
      })
      .eq('id', taskId);
  }
}

/**
 * POST /api/v1/tasks
 * 创建后台任务
 * Body: { user_id: string, task_type: string, resource_id: number, resource_title: string }
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, task_type, resource_id, resource_title } = req.body;
    
    if (!user_id || !task_type) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = getSupabaseClient();
    
    // 检查是否已有相同资源的任务在进行中
    if (resource_id) {
      const { data: existingTask, error: checkError } = await client
        .from('background_tasks')
        .select('id, status, progress')
        .eq('user_id', user_id)
        .eq('resource_id', resource_id)
        .in('status', ['pending', 'running'])
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingTask) {
        return res.json({ 
          success: true, 
          task: existingTask,
          message: '已有相同任务在进行中' 
        });
      }
    }
    
    // 创建任务
    const { data: task, error: createError } = await client
      .from('background_tasks')
      .insert({
        user_id,
        task_type,
        status: 'pending',
        resource_id: resource_id || null,
        resource_title: resource_title || null,
      })
      .select()
      .single();
    
    if (createError) throw createError;
    
    // 异步执行任务
    if (task_type === 'generate_course_audio' && resource_id) {
      // 提取请求头用于 TTS 调用
      const headers = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
      
      setImmediate(() => {
        executeGenerateCourseAudio(task.id, resource_id, resource_title || '', headers);
      });
    }
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ error: '创建任务失败' });
  }
});

/**
 * GET /api/v1/tasks/:taskId
 * 查询任务状态
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data: task, error } = await client
      .from('background_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user_id)
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('查询任务失败:', error);
    res.status(500).json({ error: '查询任务失败' });
  }
});

/**
 * GET /api/v1/tasks
 * 查询用户任务列表
 * Query: user_id, task_type, status
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, task_type, status, limit = '10' } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    let query = client
      .from('background_tasks')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string, 10));
    
    if (task_type) {
      query = query.eq('task_type', task_type);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: tasks, error } = await query;
    
    if (error) throw error;
    
    res.json({ success: true, tasks: tasks || [] });
  } catch (error) {
    console.error('查询任务列表失败:', error);
    res.status(500).json({ error: '查询任务列表失败' });
  }
});

/**
 * DELETE /api/v1/tasks/:taskId
 * 取消/删除任务
 */
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 检查任务状态
    const { data: task, error: fetchError } = await client
      .from('background_tasks')
      .select('id, status')
      .eq('id', taskId)
      .eq('user_id', user_id)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // 如果任务正在运行，只标记为取消（后台任务会检查状态）
    // 如果任务已完成或失败，直接删除
    if (task.status === 'running') {
      await client
        .from('background_tasks')
        .update({ 
          status: 'cancelled', 
          error_message: '用户取消',
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);
    } else {
      await client
        .from('background_tasks')
        .delete()
        .eq('id', taskId);
    }
    
    res.json({ success: true, message: '任务已取消' });
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({ error: '取消任务失败' });
  }
});

export default router;
