import express from "express";
import cors from "cors";
import materialsRouter from "./routes/materials";
import learningRouter from "./routes/learning";
import speechRouter from "./routes/speech";
import translateRouter from "./routes/translate";
import letterPronunciationRouter from "./routes/letter-pronunciation";
import videoDownloadRouter from "./routes/video-download";
import sentenceFilesRouter from "./routes/sentence-files";
import authRouter from "./routes/auth";
import statsRouter from "./routes/stats";
import shareRouter from "./routes/share";
import myFilesRouter from "./routes/my-files";
import errorWordsRouter from "./routes/error-words";
import pdfParseRouter from "./routes/pdf-parse";
import coursesRouter from "./routes/courses";
import uploadRouter from "./routes/upload";
import perfectRecordingsRouter from "./routes/perfect-recordings";
import usersRouter from "./routes/users";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());

// Health check - 在 body parser 之前，不需要解析 body
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes - 文件上传路由放在 body parser 之前，避免影响 multipart/form-data
app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1/materials/download', videoDownloadRouter);
app.use('/api/v1/materials', materialsRouter);

// Body parser - 放在文件上传路由之后
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// sentence-files 路由 - 放在 body parser 之后，因为有些接口需要解析 JSON body
app.use('/api/v1/sentence-files', sentenceFilesRouter);

// 其他 API 路由
app.use('/api/v1/learning-records', learningRouter);
app.use('/api/v1/speech-recognize', speechRouter);
app.use('/api/v1/translate', translateRouter);
app.use('/api/v1/letter-pronunciation', letterPronunciationRouter);

// 用户认证路由
app.use('/api/v1/auth', authRouter);

// 学习统计路由
app.use('/api/v1/stats', statsRouter);

// 句库分享路由
app.use('/api/v1/share', shareRouter);

// 我的句库路由
app.use('/api/v1/my-files', myFilesRouter);

// 错题本路由
app.use('/api/v1/error-words', errorWordsRouter);

// PDF 解析路由
app.use('/api/v1/pdf-parse', pdfParseRouter);

// 课程路由
app.use('/api/v1/courses', coursesRouter);

// 完美发音记录路由
app.use('/api/v1/perfect-recordings', perfectRecordingsRouter);

// 用户路由
app.use('/api/v1/users', usersRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack?.substring(0, 500));
  
  // 处理 payload too large 错误
  if (err.message.includes('too large') || err.message.includes('entity')) {
    return res.status(413).json({ 
      error: '文件太大', 
      message: '上传的文件超过了500MB限制，请选择较小的文件' 
    });
  }
  
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
