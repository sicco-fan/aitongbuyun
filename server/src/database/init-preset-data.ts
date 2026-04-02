import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 初始化预置句库数据
 * 在服务器启动时调用，检查是否存在预置数据，如果不存在则插入
 */
export async function initializePresetData(): Promise<void> {
  try {
    // 检查是否已存在预置数据
    const checkResult = await pool.query(
      "SELECT COUNT(*) FROM sentence_files WHERE source_type = 'preset'"
    );
    
    const count = parseInt(checkResult.rows[0].count, 10);
    if (count > 0) {
      console.log('[预置数据] 已存在预置句库，跳过初始化');
      return;
    }

    console.log('[预置数据] 开始初始化预置句库...');

    // 新概念英语第一册
    await insertPresetFile(
      '新概念英语第一册',
      '《新概念英语》第一册学习内容，适合英语初学者。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除，如需长期使用请购买正版教材。',
      [
        'Excuse me.',
        'Yes?',
        'Is this your handbag?',
        'Pardon?',
        'Is this your handbag?',
        'Yes, it is.',
        'Thank you very much.',
        'My coat and my umbrella, please.',
        'Here is my ticket.',
        'Thank you, sir.',
        'This is not my umbrella.',
        'Sorry, sir.',
        'My name is Robert.',
        'I am a new student.',
        'What nationality are you?',
        'I am Italian.',
        'Is this your shirt?',
        'No, it is not.',
        'Whose shirt is this?',
        'It is my shirt.',
        'Good morning.',
        'How are you today?',
        'I am very well, thank you.',
        'And how are you?',
        'Nice to meet you.',
        'What is your name?',
        'My name is Sophie.',
        'Are you French?',
        'Yes, I am.',
        'What make is your car?',
      ]
    );

    // 新概念英语第二册
    await insertPresetFile(
      '新概念英语第二册',
      '《新概念英语》第二册学习内容，适合有一定英语基础的学习者。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除，如需长期使用请购买正版教材。',
      [
        'Last week I went to the theatre.',
        'I had a very good seat.',
        'The play was very interesting.',
        'I did not enjoy it.',
        'A young man and a young woman were sitting behind me.',
        'They were talking loudly.',
        'I got very angry.',
        'I could not hear the actors.',
        'I turned round.',
        'I looked at the man and the woman angrily.',
        'They did not pay any attention.',
        'In the end, I could not bear it.',
        'I turned round again.',
        'I cannot hear a word!',
        'It is none of your business.',
        'This is a private conversation!',
        'It was Sunday.',
        'I never get up early on Sundays.',
        'I sometimes stay in bed until lunch time.',
        'Last Sunday I got up very late.',
        'I looked out of the window.',
        'It was dark outside.',
        'What a day!',
        'I thought it was still raining.',
        'Then the telephone rang.',
        'It was my aunt Lucy.',
        'I have just arrived by train.',
        'I am coming to see you.',
        'But I am still having breakfast.',
        'What are you doing?',
      ]
    );

    // 新概念英语第三册
    await insertPresetFile(
      '新概念英语第三册',
      '《新概念英语》第三册学习内容，适合中高级英语学习者。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除，如需长期使用请购买正版教材。',
      [
        'Pumas are large, cat-like animals which are found in America.',
        'When reports came into London Zoo that a wild puma had been spotted, they were not taken seriously.',
        'However, as the evidence began to accumulate, experts felt obliged to investigate.',
        'The hunt for the puma began in a small village.',
        'It immediately ran away when she saw it.',
        'Experts confirmed that a puma will not attack a human being unless it is cornered.',
        'The search proved difficult.',
        'Wherever it went, it left behind it a trail of dead deer and small animals.',
        'Paw prints were seen in a number of places.',
        'Several people complained of cat-like noises at night.',
        'The experts were now fully convinced that the animal was a puma.',
        'This one must have been in the possession of a private collector.',
        'The hunt went on for several weeks, but the puma was not caught.',
        'It is disturbing to think that a dangerous wild animal is still at large.',
        'Our vicar is always raising money for one cause or another.',
        'But he has never managed to get enough money to have the church clock repaired.',
        'The big clock was damaged many years ago.',
        'One night, our vicar woke up with a start.',
        'The clock was striking the hours!',
        'Looking at his watch, he saw that it was one o clock.',
      ]
    );

    // 如何用AI从0做到100万美元
    await insertPresetFile(
      '如何用AI从0做到100万美元',
      'AI创业指南：从零开始打造百万美元业务。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除。',
      [
        'The AI revolution is creating unprecedented opportunities for entrepreneurs.',
        'In this guide, we will explore how to build a million-dollar AI business.',
        'The first step is to identify a real problem that AI can solve efficiently.',
        'Many successful AI startups began with a simple observation about everyday friction.',
        'You do not need to be a machine learning expert to start an AI company.',
        'The key is to understand your customers better than anyone else.',
        'Start small and iterate quickly based on user feedback.',
        'Your first version does not need to be perfect, it needs to be useful.',
        'Focus on one specific use case rather than trying to solve everything.',
        'The best AI products often feel like magic to users.',
        'Building a great team is essential for scaling your AI business.',
        'Look for people who are passionate about the problem you are solving.',
        'Do not underestimate the importance of good documentation and customer support.',
        'Pricing your AI product correctly can make or break your business.',
        'Consider offering a free tier to attract users.',
        'Marketing an AI product requires explaining complex technology in simple terms.',
        'Use case studies and testimonials to build trust with potential customers.',
        'Stay up to date with the latest AI research and developments.',
        'The AI landscape changes rapidly, and adaptability is key to success.',
        'Remember that technology is just a tool to serve human needs and desires.',
      ]
    );

    console.log('[预置数据] 预置句库初始化完成');
  } catch (error) {
    console.error('[预置数据] 初始化失败:', error);
  }
}

/**
 * 插入单个预置句库文件
 */
async function insertPresetFile(title: string, description: string, sentences: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 插入句库文件
    const fileResult = await client.query(
      `INSERT INTO sentence_files (title, description, source_type, status, created_by) 
       VALUES ($1, $2, 'preset', 'ready', 'system') 
       RETURNING id`,
      [title, description]
    );

    const fileId = fileResult.rows[0].id;

    // 插入句子
    for (let i = 0; i < sentences.length; i++) {
      await client.query(
        `INSERT INTO sentence_file_items (sentence_file_id, sentence_index, text) 
         VALUES ($1, $2, $3)`,
        [fileId, i + 1, sentences[i]]
      );
    }

    await client.query('COMMIT');
    console.log(`[预置数据] 已插入: ${title} (${sentences.length}句)`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
