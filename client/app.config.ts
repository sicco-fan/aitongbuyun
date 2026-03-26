import { ExpoConfig, ConfigContext } from 'expo/config';

const appName = process.env.COZE_PROJECT_NAME || process.env.EXPO_PUBLIC_COZE_PROJECT_NAME || '啃句大师';
const projectId = process.env.COZE_PROJECT_ID || process.env.EXPO_PUBLIC_COZE_PROJECT_ID;
const slugAppName = projectId ? `app${projectId}` : 'myapp';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    "name": appName,
    "slug": slugAppName,
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSMicrophoneUsageDescription": `啃句大师需要访问麦克风以播放音频内容。`,
        "NSPhotoLibraryUsageDescription": `允许啃句大师访问您的相册，以便您上传或保存图片。`,
        "NSCameraUsageDescription": `允许啃句大师使用您的相机，以便您直接拍摄照片上传。`
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": `com.anonymous.x${projectId || '0'}`,
      "permissions": [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
        "android.permission.INTERNET"
      ]
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      process.env.EXPO_PUBLIC_BACKEND_BASE_URL ? [
        "expo-router",
        {
          "origin": process.env.EXPO_PUBLIC_BACKEND_BASE_URL
        }
      ] : 'expo-router',
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "expo-av",
        {
          "microphonePermission": `啃句大师需要访问麦克风以播放音频内容。`
        }
      ],
      [
        "expo-document-picker",
        {
          "iCloudContainerEnvironment": "Production"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": `允许啃句大师访问您的相册，以便您上传或保存图片。`,
          "cameraPermission": `允许啃句大师使用您的相机，以便您直接拍摄照片上传。`,
          "microphonePermission": `允许啃句大师访问您的麦克风，以便您拍摄带有声音的视频。`
        }
      ],
      "expo-asset",
      [
        "expo-media-library",
        {
          "photosPermission": `允许啃句大师访问您的相册，以便您上传视频文件。`,
          "savePhotosPermission": `允许啃句大师保存图片到相册。`,
          "isAccessMediaLocationEnabled": true
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
