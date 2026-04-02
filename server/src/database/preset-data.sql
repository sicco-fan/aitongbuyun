-- 预置句库数据
-- 新概念英语第一册、第二册、第三册 + AI创业课程
-- 注意：此数据仅供功能演示，请在24小时内自行删除

-- 新概念英语第一册
INSERT INTO sentence_files (title, description, source_type, status, created_by) 
VALUES ('新概念英语第一册', '《新概念英语》第一册学习内容，适合英语初学者。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除，如需长期使用请购买正版教材。', 'preset', 'ready', 'system');

INSERT INTO sentence_file_items (sentence_file_id, sentence_index, text) VALUES
-- Lesson 1: Excuse me
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 1, 'Excuse me.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 2, 'Yes?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 3, 'Is this your handbag?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 4, 'Pardon?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 5, 'Is this your handbag?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 6, 'Yes, it is.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 7, 'Thank you very much.'),
-- Lesson 2
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 8, 'My coat and my umbrella, please.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 9, 'Here is my ticket.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 10, 'Thank you, sir.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 11, 'This is not my umbrella.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 12, 'Sorry, sir.'),
-- Lesson 3
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 13, 'My name is Robert.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 14, 'I am a new student.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 15, 'What nationality are you?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 16, 'I am Italian.'),
-- Lesson 4
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 17, 'Is this your shirt?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 18, 'No, it is not.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 19, 'Whose shirt is this?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 20, 'It is my shirt.'),
-- Lesson 5
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 21, 'Good morning.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 22, 'How are you today?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 23, 'I am very well, thank you.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 24, 'And how are you?'),
-- More sample sentences
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 25, 'Nice to meet you.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 26, 'What is your name?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 27, 'My name is Sophie.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 28, 'Are you French?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 29, 'Yes, I am.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第一册'), 30, 'What make is your car?');

-- 新概念英语第二册
INSERT INTO sentence_files (title, description, source_type, status, created_by) 
VALUES ('新概念英语第二册', '《新概念英语》第二册学习内容，适合有一定英语基础的学习者。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除，如需长期使用请购买正版教材。', 'preset', 'ready', 'system');

INSERT INTO sentence_file_items (sentence_file_id, sentence_index, text) VALUES
-- Lesson 1: A private conversation
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 1, 'Last week I went to the theatre.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 2, 'I had a very good seat.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 3, 'The play was very interesting.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 4, 'I did not enjoy it.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 5, 'A young man and a young woman were sitting behind me.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 6, 'They were talking loudly.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 7, 'I got very angry.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 8, 'I could not hear the actors.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 9, 'I turned round.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 10, 'I looked at the man and the woman angrily.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 11, 'They did not pay any attention.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 12, 'In the end, I could not bear it.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 13, 'I turned round again.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 14, 'I cannot hear a word!'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 15, 'It is none of your business.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 16, 'This is a private conversation!'),
-- Lesson 2: Breakfast or lunch
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 17, 'It was Sunday.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 18, 'I never get up early on Sundays.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 19, 'I sometimes stay in bed until lunch time.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 20, 'Last Sunday I got up very late.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 21, 'I looked out of the window.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 22, 'It was dark outside.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 23, 'What a day!'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 24, 'I thought it was still raining.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 25, 'Then the telephone rang.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 26, 'It was my aunt Lucy.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 27, 'I have just arrived by train.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 28, 'I am coming to see you.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 29, 'But I am still having breakfast.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第二册'), 30, 'What are you doing?');

-- 新概念英语第三册
INSERT INTO sentence_files (title, description, source_type, status, created_by) 
VALUES ('新概念英语第三册', '《新概念英语》第三册学习内容，适合中高级英语学习者。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除，如需长期使用请购买正版教材。', 'preset', 'ready', 'system');

INSERT INTO sentence_file_items (sentence_file_id, sentence_index, text) VALUES
-- Lesson 1: A puma at large
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 1, 'Pumas are large, cat-like animals which are found in America.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 2, 'When reports came into London Zoo that a wild puma had been spotted forty-five miles south of London, they were not taken seriously.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 3, 'However, as the evidence began to accumulate, experts from the Zoo felt obliged to investigate.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 4, 'The hunt for the puma began in a small village where a woman picking blackberries saw a large cat only five yards away from her.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 5, 'It immediately ran away when she saw it, and experts confirmed that a puma will not attack a human being unless it is cornered.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 6, 'The search proved difficult, for the puma was often observed at one place in the morning and at another place twenty miles away in the evening.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 7, 'Wherever it went, it left behind it a trail of dead deer and small animals like rabbits.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 8, 'Paw prints were seen in a number of places and puma fur was found clinging to bushes.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 9, 'Several people complained of cat-like noises at night and a businessman on a fishing trip saw the puma up a tree.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 10, 'The experts were now fully convinced that the animal was a puma, but where had it come from?'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 11, 'As no pumas had been reported missing from any zoo in the country, this one must have been in the possession of a private collector.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 12, 'The hunt went on for several weeks, but the puma was not caught.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 13, 'It is disturbing to think that a dangerous wild animal is still at large in the quiet countryside.'),
-- Lesson 2: Thirteen equals one
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 14, 'Our vicar is always raising money for one cause or another.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 15, 'But he has never managed to get enough money to have the church clock repaired.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 16, 'The big clock which used to strike the hours day and night was damaged many years ago and has been silent ever since.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 17, 'One night, however, our vicar woke up with a start: the clock was striking the hours!'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 18, 'Looking at his watch, he saw that it was one o''clock.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 19, 'But the bell struck thirteen times before it stopped.'),
((SELECT id FROM sentence_files WHERE title = '新概念英语第三册'), 20, 'Armed with a torch, the vicar went up into the clock tower to see what was going on.');

-- 如何用AI从0做到100万美元
INSERT INTO sentence_files (title, description, source_type, status, created_by) 
VALUES ('如何用AI从0做到100万美元', 'AI创业指南：从零开始打造百万美元业务。版权免责：此内容仅供功能演示，请在下载后24小时内自行删除。', 'preset', 'ready', 'system');

INSERT INTO sentence_file_items (sentence_file_id, sentence_index, text) VALUES
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 1, 'The AI revolution is creating unprecedented opportunities for entrepreneurs.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 2, 'In this guide, we will explore how to build a million-dollar AI business from scratch.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 3, 'The first step is to identify a real problem that AI can solve efficiently.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 4, 'Many successful AI startups began with a simple observation about everyday friction.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 5, 'You do not need to be a machine learning expert to start an AI company.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 6, 'The key is to understand your customers better than anyone else.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 7, 'Start small and iterate quickly based on user feedback.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 8, 'Your first version does not need to be perfect, it needs to be useful.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 9, 'Focus on one specific use case rather than trying to solve everything.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 10, 'The best AI products often feel like magic to users.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 11, 'Building a great team is essential for scaling your AI business.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 12, 'Look for people who are passionate about the problem you are solving.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 13, 'Do not underestimate the importance of good documentation and customer support.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 14, 'Pricing your AI product correctly can make or break your business.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 15, 'Consider offering a free tier to attract users and a premium tier for power users.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 16, 'Marketing an AI product requires explaining complex technology in simple terms.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 17, 'Use case studies and testimonials to build trust with potential customers.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 18, 'Stay up to date with the latest AI research and developments.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 19, 'The AI landscape changes rapidly, and adaptability is key to long-term success.'),
((SELECT id FROM sentence_files WHERE title = '如何用AI从0做到100万美元'), 20, 'Remember that technology is just a tool to serve human needs and desires.');
