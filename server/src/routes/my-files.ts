import express from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client';

const router = express.Router();

/**
 * GET /api/v1/my-files
 * 获取所有句库列表（包括用户创建的和预置的）
 * Query: user_id, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, page = '1', limit = '20' } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 50);
    const offset = (pageNum - 1) * limitNum;
    
    // 获取所有句库（包括预置的）
    const { data: files, error } = await client
      .from('sentence_files')
      .select(`
        id,
        title,
        description,
        original_duration,
        source_type,
        status,
        created_by,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    
    if (error) throw error;
    
    // 获取每个文件的句子数量
    const filesWithStats = await Promise.all(
      (files || []).map(async (file) => {
        const { count: totalCount, error: countError } = await client
          .from('sentence_file_items')
          .select('*', { count: 'exact', head: true })
          .eq('sentence_file_id', file.id);
        
        const { count: readyCount, error: readyError } = await client
          .from('sentence_file_items')
          .select('*', { count: 'exact', head: true })
          .eq('sentence_file_id', file.id)
          .not('start_time', 'is', null)
          .not('end_time', 'is', null);
        
        // 检查是否已分享
        const { data: share, error: shareError } = await client
          .from('shared_sentence_files')
          .select('id, download_count')
          .eq('sentence_file_id', file.id)
          .eq('is_active', true)
          .maybeSingle();
        
        // 判断是否为预置句库
        const isPreset = file.source_type === 'preset';
        // 判断是否为用户自己创建的句库
        const isOwner = file.created_by === user_id;
        
        return {
          ...file,
          sentences_count: totalCount || 0,
          ready_sentences_count: readyCount || 0,
          is_shared: !!share,
          share_info: share ? { id: share.id, download_count: share.download_count } : null,
          is_preset: isPreset,
          is_owner: isOwner,
        };
      })
    );
    
    // 获取总数
    const { count, error: countError } = await client
      .from('sentence_files')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    res.json({ 
      success: true, 
      files: filesWithStats,
      total: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    console.error('获取句库列表失败:', error);
    res.status(500).json({ error: '获取句库列表失败' });
  }
});

/**
 * GET /api/v1/my-files/:id
 * 获取句库详情（包含句子列表）
 * Query: user_id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 获取句库信息
    const { data: file, error: fileError } = await client
      .from('sentence_files')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (fileError) throw fileError;
    
    if (!file) {
      return res.status(404).json({ error: '句库不存在' });
    }
    
    // 获取句子列表
    const { data: items, error: itemsError } = await client
      .from('sentence_file_items')
      .select('*')
      .eq('sentence_file_id', id)
      .order('sentence_index', { ascending: true });
    
    if (itemsError) throw itemsError;
    
    // 检查分享状态
    const { data: share, error: shareError } = await client
      .from('shared_sentence_files')
      .select('id, download_count, created_at')
      .eq('sentence_file_id', id)
      .eq('is_active', true)
      .maybeSingle();
    
    // 判断是否为预置句库和用户创建的
    const isPreset = file.source_type === 'preset';
    const isOwner = file.created_by === user_id;
    
    res.json({ 
      success: true, 
      file: {
        ...file,
        items: items || [],
        is_shared: !!share,
        share_info: share,
        is_preset: isPreset,
        is_owner: isOwner,
      }
    });
  } catch (error) {
    console.error('获取句库详情失败:', error);
    res.status(500).json({ error: '获取句库详情失败' });
  }
});

/**
 * PUT /api/v1/my-files/:id
 * 更新句库信息（允许所有用户操作）
 * Body: { user_id: string, title?: string, description?: string }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, title, description } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 检查句库是否存在
    const { data: file, error: fileError } = await client
      .from('sentence_files')
      .select('id, title')
      .eq('id', id)
      .maybeSingle();
    
    if (fileError) throw fileError;
    
    if (!file) {
      return res.status(404).json({ error: '句库不存在' });
    }
    
    // 更新句库
    const updateData: Record<string, string | undefined> = {
      updated_at: new Date().toISOString()
    };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    
    const { data: updated, error: updateError } = await client
      .from('sentence_files')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // 如果已分享，同步更新分享记录的标题和描述
    if (title !== undefined || description !== undefined) {
      const shareUpdateData: Record<string, string | undefined> = {
        updated_at: new Date().toISOString()
      };
      if (title !== undefined) shareUpdateData.title = title;
      if (description !== undefined) shareUpdateData.description = description;
      
      await client
        .from('shared_sentence_files')
        .update(shareUpdateData)
        .eq('sentence_file_id', id)
        .eq('is_active', true);
    }
    
    res.json({ success: true, file: updated });
  } catch (error) {
    console.error('更新句库失败:', error);
    res.status(500).json({ error: '更新句库失败' });
  }
});

/**
 * DELETE /api/v1/my-files/:id
 * 删除句库（允许所有用户操作，包括预置句库）
 * Body: { user_id: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const client = getSupabaseClient();
    
    // 检查句库是否存在
    const { data: file, error: fileError } = await client
      .from('sentence_files')
      .select('id, title, source_type')
      .eq('id', id)
      .maybeSingle();
    
    if (fileError) throw fileError;
    
    if (!file) {
      return res.status(404).json({ error: '句库不存在' });
    }
    
    // 取消分享（如果已分享）
    await client
      .from('shared_sentence_files')
      .update({ is_active: false })
      .eq('sentence_file_id', id);
    
    // 删除句子项（级联删除）
    await client
      .from('sentence_file_items')
      .delete()
      .eq('sentence_file_id', id);
    
    // 删除句库
    await client
      .from('sentence_files')
      .delete()
      .eq('id', id);
    
    res.json({ success: true, message: '句库已删除' });
  } catch (error) {
    console.error('删除句库失败:', error);
    res.status(500).json({ error: '删除句库失败' });
  }
});

export default router;
