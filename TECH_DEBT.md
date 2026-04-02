# 技术债务清单

> 记录项目中需要关注的技术债务和待优化项

---

## 一、高优先级 (建议发布前处理)

### 1. 无

当前无阻塞发布的高优先级技术债务。

---

## 二、中优先级 (后续版本处理)

### 1. expo-av 废弃警告 ⚠️

**状态**: 已废弃，SDK 54 后将被移除

**警告信息**:
```
[expo-av]: Expo AV has been deprecated and will be removed in SDK 54. 
Use the `expo-audio` and `expo-video` packages to replace the required functionality.
```

**影响文件**:
- `client/screens/edit-sentence-audio/index.tsx`
- `client/screens/sentence-practice/index.tsx`
- `client/screens/create-sentence-file/index.tsx`
- `client/screens/edit-text-content/index.tsx`
- `client/components/AudioPlayer.tsx`

**迁移方案**:
```bash
# 安装新包
npx expo install expo-audio expo-video
```

**迁移工作量**: 中等
- Audio 录音功能 → expo-audio
- Audio 播放功能 → expo-audio
- 需要修改 API 调用方式

**建议处理时间**: 下一个大版本更新时

---

## 三、低优先级 (可选优化)

### 1. shadow* 样式属性警告

**警告信息**:
```
"shadow*" style props are deprecated. Use "boxShadow".
```

**说明**:
- 这是 Web 端的警告
- React Native 原生端仍需使用 shadow* 属性
- iOS 使用 shadowColor/shadowOffset/shadowOpacity/shadowRadius
- Android 使用 elevation

**影响文件**:
- `client/screens/sentence-practice/styles.ts`
- `client/screens/sentence-practice/index.tsx`
- `client/screens/sentence-workshop/styles.ts`
- `client/components/SmartDateInput.tsx`

**处理方案**:
可以添加平台判断，Web 端使用 boxShadow：
```typescript
import { Platform } from 'react-native';

const shadowStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  android: {
    elevation: 4,
  },
  web: {
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
});
```

**建议处理时间**: 有空时优化

---

### 2. pointerEvents 属性警告 ✅ 已修复

**警告信息**:
```
props.pointerEvents is deprecated. Use style.pointerEvents
```

**状态**: 已在 v1.0.0 修复

**修复内容**:
- `client/screens/sentence-practice/index.tsx` (3处)
- 将 `pointerEvents="none"` 迁移到 `style={{ pointerEvents: 'none' }}`

---

### 3. 未使用的依赖包

**检测到未使用的依赖**:
- `@react-native-community/slider`
- `@react-native-masked-view/masked-view`
- `@react-native-picker/picker`
- `expo-camera`
- `expo-location`
- `expo-blur`
- `react-native-chart-kit` (已用 react-native-gifted-charts 替代)
- `zod` (后端使用，前端可能未使用)

**处理方案**:
可以在下一个版本清理，但保留这些依赖不会有负面影响。

---

## 四、代码质量建议

### 1. 日志输出
- 生产构建已配置自动移除 console.log
- 建议使用 `utils/logger.ts` 统一管理日志

### 2. 类型安全
- 部分组件使用了 `any` 类型
- 建议逐步完善类型定义

### 3. 代码复用
- 部分 API 调用可以抽取为 hooks
- 样式可以进一步模块化

---

## 五、待办事项

| 项目 | 优先级 | 状态 | 预计工作量 |
|------|--------|------|------------|
| expo-av → expo-audio 迁移 | 中 | 待处理 | 2-3天 |
| shadow 样式优化 | 低 | 待处理 | 0.5天 |
| pointerEvents 迁移 | 低 | 待处理 | 0.5小时 |
| 清理未使用依赖 | 低 | 待处理 | 0.5小时 |

---

## 六、版本规划建议

### v1.0.0 (当前)
- ✅ 核心功能完整
- ✅ 发布准备完成
- expo-av 仍然可用，不影响发布

### v1.1.0 (建议)
- 迁移 expo-av 到 expo-audio
- 优化 shadow 样式
- 清理未使用依赖

### v2.0.0 (未来)
- 根据用户反馈优化功能
- 代码架构重构
