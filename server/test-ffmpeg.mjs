import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

ffmpeg.on('log', ({ message }) => {
  console.log(message);
});

ffmpeg.on('progress', ({ progress }) => {
  console.log(`Progress: ${progress * 100}%`);
});

async function test() {
  try {
    // 加载 ffmpeg - 使用本地安装的 core
    await ffmpeg.load();
    console.log('FFmpeg 加载成功！');
  } catch (e) {
    console.error('FFmpeg 加载失败:', e);
  }
}

test();
