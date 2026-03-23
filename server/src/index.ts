import express from "express";
import cors from "cors";
import materialsRouter from "./routes/materials";
import learningRouter from "./routes/learning";
import speechRouter from "./routes/speech";
import translateRouter from "./routes/translate";
import letterPronunciationRouter from "./routes/letter-pronunciation";
import videoDownloadRouter from "./routes/video-download";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Health check
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes - 注意：更具体的路由要放在前面
app.use('/api/v1/materials/download', videoDownloadRouter);
app.use('/api/v1/materials', materialsRouter);
app.use('/api/v1/learning-records', learningRouter);
app.use('/api/v1/speech-recognize', speechRouter);
app.use('/api/v1/translate', translateRouter);
app.use('/api/v1/letter-pronunciation', letterPronunciationRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
