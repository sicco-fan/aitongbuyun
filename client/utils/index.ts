import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

/**
 * 创建跨平台兼容的文件对象，用于 FormData.append()
 * - Web 端返回 File 对象
 * - 移动端返回 { uri, type, name } 对象（RN fetch 会自动处理）
 * @param fileUri Expo 媒体库（如 expo-image-picker、expo-camera）返回的 uri
 * @param fileName 上传时的文件名，如 'photo.jpg'
 * @param mimeType 文件 MIME 类型，如 'image/jpeg'、'audio/mpeg'
 */
export async function createFormDataFile(
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<File | { uri: string; type: string; name: string }> {
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    return new File([blob], fileName, { type: mimeType });
  }

  // iOS 相册视频的 ph:// URI 需要特殊处理
  if (Platform.OS === 'ios' && fileUri.startsWith('ph://')) {
    console.log('处理 iOS 相册 ph:// URI:', fileUri);
    
    // 方案1：使用 expo-media-library 获取实际文件路径
    try {
      // 请求媒体库权限
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        // 从 ph:// URI 中提取 asset ID
        // ph:// 格式通常是 ph://assetID.ext 或 ph://assetID
        const assetIdMatch = fileUri.match(/ph:\/\/([^/.]+)/);
        if (assetIdMatch) {
          const assetId = assetIdMatch[1];
          console.log('尝试用 MediaLibrary 获取 asset:', assetId);
          
          // 获取资产信息
          const assets = await MediaLibrary.getAssetsAsync({
            first: 1,
            mediaType: ['video'],
            sortBy: [MediaLibrary.SortBy.creationTime],
          });
          
          // 查找匹配的资产
          const matchedAsset = assets.assets.find(a => 
            a.uri.includes(assetId) || fileUri.includes(a.id)
          );
          
          if (matchedAsset) {
            console.log('找到匹配的资产:', matchedAsset);
            
            // 获取本地 URI
            const localUri = (matchedAsset as any).localUri || matchedAsset.uri;
            if (localUri && !localUri.startsWith('ph://')) {
              console.log('获取到本地 URI:', localUri);
              return { uri: localUri, type: mimeType, name: fileName };
            }
          }
        }
      }
    } catch (e) {
      console.log('MediaLibrary 处理失败:', e);
    }
    
    // 方案2：使用 expo-asset 尝试加载
    try {
      const asset = Asset.fromURI(fileUri);
      await asset.downloadAsync();
      
      if ((asset as any).localUri) {
        console.log('Asset 本地 URI:', (asset as any).localUri);
        return { uri: (asset as any).localUri, type: mimeType, name: fileName };
      }
    } catch (e) {
      console.log('expo-asset 处理失败:', e);
    }
    
    // 方案3：复制到缓存目录
    try {
      const cacheDir = (FileSystem as any).cacheDirectory;
      const localUri = `${cacheDir}${fileName}`;
      
      console.log('尝试复制 ph:// 文件到缓存目录...');
      await (FileSystem as any).copyAsync({
        from: fileUri,
        to: localUri,
      });
      
      // 验证文件是否存在
      const fileInfo = await (FileSystem as any).getInfoAsync(localUri);
      if (fileInfo.exists) {
        console.log('复制成功:', localUri);
        return { uri: localUri, type: mimeType, name: fileName };
      }
    } catch (e) {
      console.log('复制到缓存目录失败:', e);
    }
    
    // 最后的备选方案：直接使用 ph:// URI
    console.log('使用原始 ph:// URI');
    return { uri: fileUri, type: mimeType, name: fileName };
  }

  // Android content:// URI
  if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
    console.log('处理 Android content:// URI:', fileUri);
    
    try {
      // 复制到缓存目录
      const cacheDir = (FileSystem as any).cacheDirectory;
      const localUri = `${cacheDir}${fileName}`;
      
      await (FileSystem as any).copyAsync({
        from: fileUri,
        to: localUri,
      });
      
      console.log('复制到缓存目录:', localUri);
      return { uri: localUri, type: mimeType, name: fileName };
    } catch (e) {
      console.log('复制失败，直接使用原 URI:', e);
      return { uri: fileUri, type: mimeType, name: fileName };
    }
  }

  return { uri: fileUri, type: mimeType, name: fileName };
}

/**
 * 构建文件或图片完整的URL
 * @param url 相对或绝对路径
 * @param w 宽度 (px) - 自动向下取整
 * @param h 高度 (px)
 */
export const buildAssetUrl = (url?: string | null, w?: number, h?: number): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url; // 绝对路径直接返回

  // 1. 去除 Base 尾部和 Path 头部的斜杠
  const base = API_BASE;
  const path = url.replace(/^\//, '');
  const abs = `${base}/${path}`;

  // 2. 无需缩略图则直接返回
  if (!w && !h) return abs;

  // 3. 构造参数，保留原有 Query (如有)
  const separator = abs.includes('?') ? '&' : '?';
  const query = [
    w ? `w=${Math.floor(w)}` : '',
    h ? `h=${Math.floor(h)}` : ''
  ].filter(Boolean).join('&');
  return `${abs}${separator}${query}`;
};

/**
 * 将UTC时间字符串转换为本地时间字符串
 * @param utcDateStr UTC时间字符串，格式如：2025-11-26T01:49:48.009573
 * @returns 本地时间字符串，格式如：2025-11-26 08:49:48
 */
export const convertToLocalTimeStr = (utcDateStr: string): string => {
  if (!utcDateStr) {
    return utcDateStr;
  }
  const microUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}/;
  if (!microUtcRegex.test(utcDateStr)) {
    console.log('invalid utcDateStr:', utcDateStr);
    return utcDateStr;
  }
  const normalized = utcDateStr.replace(/\.(\d{6})$/, (_, frac) => `.${frac.slice(0, 3)}`);
  const d = dayjs.utc(normalized);
  if (!d.isValid()) {
    return utcDateStr;
  }
  return d.local().format('YYYY-MM-DD HH:mm:ss');
}
