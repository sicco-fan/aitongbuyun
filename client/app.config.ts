import { ExpoConfig, ConfigContext } from 'expo/config';

const appName = process.env.COZE_PROJECT_NAME || process.env.EXPO_PUBLIC_COZE_PROJECT_NAME || 'AI听写云';
const projectId = process.env.COZE_PROJECT_ID || process.env.EXPO_PUBLIC_COZE_PROJECT_ID;

// 正式包名：个人开发者建议使用 com.用户名.应用名 格式
// 注意：Android 包名规则要求每个 '.' 后必须跟字母，不能直接跟数字
// 所以 projectId 前需要加字母前缀 'p'
const androidPackage = `com.aidictation.app${projectId ? `.p${projectId}` : ''}`;
const iosBundleIdentifier = `com.aidictation.app${projectId ? `.p${projectId}` : ''}`;

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    "name": appName,
    "slug": `aidictation${projectId ? `-${projectId}` : ''}`,
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "aidictation",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": iosBundleIdentifier,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "AI听写云需要访问麦克风以录制您的语音进行学习练习。",
        "NSPhotoLibraryUsageDescription": "允许AI听写云访问您的相册，以便您上传或保存图片。",
        "NSCameraUsageDescription": "允许AI听写云使用您的相机，以便您直接拍摄照片上传。",
        "NSSpeechRecognitionUsageDescription": "AI听写云需要语音识别功能来评估您的发音准确性。"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#3B82F6"
      },
      "package": androidPackage,
      "softwareKeyboardLayoutMode": "pan",
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
          "backgroundColor": "#3B82F6"
        }
      ],
      [
        "expo-av",
        {
          "microphonePermission": "AI听写云需要访问麦克风以录制您的语音进行学习练习。"
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
          "photosPermission": "允许AI听写云访问您的相册，以便您上传或保存图片。",
          "cameraPermission": "允许AI听写云使用您的相机，以便您直接拍摄照片上传。",
          "microphonePermission": "允许AI听写云访问您的麦克风，以便您拍摄带有声音的视频。"
        }
      ],
      "expo-asset",
      [
        "expo-media-library",
        {
          "photosPermission": "允许AI听写云访问您的相册，以便您上传视频文件。",
          "savePhotosPermission": "允许AI听写云保存图片到相册。",
          "isAccessMediaLocationEnabled": true
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "eas": {
        "projectId": projectId
      }
    }
  }
}
