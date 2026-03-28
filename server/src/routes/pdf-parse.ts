import { Router } from 'express';
import type { Request, Response } from 'express';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();

/**
 * POST /api/v1/pdf-parse
 * 解析 PDF 文件内容
 * Body: { url: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '缺少 URL 参数' });
    }
    
    console.log(`[PDF解析] 开始解析: ${url.substring(0, 100)}...`);
    
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const client = new FetchClient(config, customHeaders);
    
    const response = await client.fetch(url);
    
    if (response.status_code !== 0) {
      console.error('[PDF解析] 解析失败:', response.status_message);
      return res.status(500).json({ error: response.status_message || '解析失败' });
    }
    
    // 提取文本内容
    const textContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    
    console.log(`[PDF解析] 解析成功, 标题: ${response.title}, 文本长度: ${textContent.length}`);
    
    res.json({
      success: true,
      title: response.title,
      filetype: response.filetype,
      content: textContent,
      rawContent: response.content, // 返回原始内容结构
    });
  } catch (error) {
    console.error('[PDF解析] 错误:', error);
    res.status(500).json({ error: '解析 PDF 失败', message: String(error) });
  }
});

export default router;
