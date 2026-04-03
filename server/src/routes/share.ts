import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

/**
 * POST /api/v1/share/create
 * 分享句库
 * Body: { sentence_file_id: number, shared_by: string, description?: string }
 */
router.post('/create', async (req, res) => {
  try {
    const { sentence_file_id, shared_by, description } = req.body;
    
    if (!sentence_file_id || !shared_by) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const client = getSupabaseClient();
    
    // 获取句库信息
    const { data: file, error: fileError } = await client
      .from('sentence_files')
      .select('*')
      .eq('id', sentence_file_id)
      .single();
    
    if (fileError || !file) {
      return res.status(404).json({ error: '句库不存在' });
    }
    
    // 检查是否已分享
    const { data: existing, error: existingError } = await client
      .from('shared_sentence_files')
      .select('*')
      .eq('sentence_file_id', sentence_file_id)
      .eq('shared_by', shared_by)
      .maybeSingle();
    
    if (existingError) throw existingError;
    
    if (existing) {
      // 更新现有分享
      const { data: updated, error: updateError } = await client
        .from('shared_sentence_files')
        .update({
          description: description || existing.description,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      return res.json({ success: true, share: updated });
    }
    
    // 创建新分享
    const { data: share, error: shareError } = await client
      .from('shared_sentence_files')
      .insert({
        sentence_file_id,
        shared_by,
        title: file.title,
        description: description || file.description,
        is_active: true
      })
      .select()
      .single();
    
    if (shareError) throw shareError;
    
    res.json({ success: true, share });
  } catch (error) {
    console.error('分享句库失败:', error);
    res.status(500).json({ error: '分享句库失败' });
  }
});

/**
 * GET /api/v1/share/list
 * 获取分享的句库列表
 * Query: page, limit
 */
router.get('/list', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    
    const client = getSupabaseClient();
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 50);
    const offset = (pageNum - 1) * limitNum;
    
    const { data: shares, error } = await client
      .from('shared_sentence_files')
      .select(`
        id,
        sentence_file_id,
        shared_by,
        title,
        description,
        download_count,
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    
    if (error) throw error;
    
    // 获取分享者的昵称
    const sharesWithNickname = await Promise.all(
      (shares || []).map(async (share) => {
        const { data: sharer } = await client
          .from('users')
          .select('nickname')
          .eq('id', share.shared_by)
          .maybeSingle();
        
        return {
          ...share,
          sharer_nickname: sharer?.nickname || '匿名用户',
        };
      })
    );
    
    // 获取总数
    const { count, error: countError } = await client
      .from('shared_sentence_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    if (countError) throw countError;
    
    res.json({ 
      success: true, 
      shares: sharesWithNickname,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('获取分享列表失败:', error);
    res.status(500).json({ error: '获取分享列表失败' });
  }
});

/**
 * GET /api/v1/share/mine
 * 获取我分享的句库
 * Query: user_id
 */
router.get('/mine', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    const { data: shares, error } = await client
      .from('shared_sentence_files')
      .select('*')
      .eq('shared_by', user_id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, shares: shares || [] });
  } catch (error) {
    console.error('获取我的分享失败:', error);
    res.status(500).json({ error: '获取我的分享失败' });
  }
});

/**
 * POST /api/v1/share/download/:share_id
 * 下载分享的句库
 * Body: { user_id: string }
 */
router.post('/download/:share_id', async (req, res) => {
  try {
    const { share_id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取分享信息
    const { data: share, error: shareError } = await client
      .from('shared_sentence_files')
      .select(`
        *,
        sentence_files(
          id,
          title,
          description,
          original_audio_url,
          original_duration,
          source_type,
          source_url,
          text_content
        )
      `)
      .eq('id', share_id)
      .eq('is_active', true)
      .single();
    
    if (shareError || !share) {
      return res.status(404).json({ error: '分享不存在' });
    }
    
    // 获取句子的句子项
    const { data: items, error: itemsError } = await client
      .from('sentence_file_items')
      .select('*')
      .eq('sentence_file_id', share.sentence_file_id)
      .order('sentence_index', { ascending: true });
    
    if (itemsError) throw itemsError;
    
    // 增加下载计数
    await client
      .from('shared_sentence_files')
      .update({ download_count: (share.download_count || 0) + 1 })
      .eq('id', share_id);
    
    // 为用户创建新的句库副本
    const { data: newFile, error: newFileError } = await client
      .from('sentence_files')
      .insert({
        title: share.title,
        description: share.description,
        original_audio_url: share.sentence_files?.original_audio_url,
        original_duration: share.sentence_files?.original_duration,
        source_type: 'share',
        source_url: null,
        text_content: share.sentence_files?.text_content,
        status: 'completed',
        created_by: user_id
      })
      .select()
      .single();
    
    if (newFileError) throw newFileError;
    
    // 复制句子项
    if (items && items.length > 0) {
      const newItems = items.map(item => ({
        sentence_file_id: newFile.id,
        sentence_index: item.sentence_index,
        text: item.text,
        start_time: item.start_time,
        end_time: item.end_time,
        audio_url: item.audio_url
      }));
      
      await client.from('sentence_file_items').insert(newItems);
    }
    
    res.json({ 
      success: true, 
      message: '句库已保存到您的账户',
      file: newFile
    });
  } catch (error) {
    console.error('下载句库失败:', error);
    res.status(500).json({ error: '下载句库失败' });
  }
});

/**
 * PUT /api/v1/share/:share_id
 * 更新分享描述（允许所有用户操作）
 * Body: { user_id: string, description?: string }
 */
router.put('/:share_id', async (req, res) => {
  try {
    const { share_id } = req.params;
    const { user_id, description } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 验证分享是否存在
    const { data: share, error: shareError } = await client
      .from('shared_sentence_files')
      .select('*')
      .eq('id', share_id)
      .maybeSingle();
    
    if (shareError) throw shareError;
    
    if (!share) {
      return res.status(404).json({ error: '分享不存在' });
    }
    
    // 更新描述
    const { data: updated, error: updateError } = await client
      .from('shared_sentence_files')
      .update({ 
        description, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', share_id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ success: true, share: updated });
  } catch (error) {
    console.error('更新分享失败:', error);
    res.status(500).json({ error: '更新分享失败' });
  }
});

/**
 * DELETE /api/v1/share/:share_id
 * 取消分享（允许所有用户操作）
 * Body: { user_id: string }
 */
router.delete('/:share_id', async (req, res) => {
  try {
    const { share_id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 验证分享是否存在
    const { data: share, error: shareError } = await client
      .from('shared_sentence_files')
      .select('*')
      .eq('id', share_id)
      .maybeSingle();
    
    if (shareError) throw shareError;
    
    if (!share) {
      return res.status(404).json({ error: '分享不存在' });
    }
    
    // 设置为不活跃
    await client
      .from('shared_sentence_files')
      .update({ is_active: false })
      .eq('id', share_id);
    
    res.json({ success: true, message: '已取消分享' });
  } catch (error) {
    console.error('取消分享失败:', error);
    res.status(500).json({ error: '取消分享失败' });
  }
});

export default router;
