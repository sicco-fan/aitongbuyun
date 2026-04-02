# AI听写云 - 发布指南

## 一、发布平台选择

| 平台 | 费用 | 审核周期 | 后端部署 | 推荐顺序 |
|------|------|----------|----------|----------|
| **Coze 商店** | 免费 | 快 | 自动托管 | ⭐ 首选 |
| Google Play | $25 | 1-3天 | 需自建 | 第二步 |
| App Store | $99/年 | 1-7天 | 需自建 | 第三步 |

**建议**: 先发布到 Coze 商店验证产品，收集用户反馈后再上架主流应用商店。

---

## 二、Coze 商店发布（推荐首选）

详见: [COZE_STORE_GUIDE.md](./COZE_STORE_GUIDE.md)

### 快速步骤
1. 准备应用材料（图标、描述、截图）
2. 在 Coze 项目页面点击「发布」
3. 填写应用信息并提交审核

### 优势
- ✅ 无需开发者账号费用
- ✅ 后端自动托管部署
- ✅ 快速验证产品
- ✅ 直接面向 Coze 用户群体

---

## 三、发布前检查清单

### 1. 应用配置
- [x] 应用名称: AI听写云
- [x] 版本号: 1.0.0
- [x] Android 包名: `com.aidictation.app`
- [x] iOS Bundle ID: `com.aidictation.app`
- [x] Scheme: `aidictation`

### 2. 法律文件
- [x] 隐私政策页面 (`/privacy-policy`)
- [x] 用户协议页面 (`/user-agreement`)
- [x] 关于我们页面 (`/about`)
- [ ] ⚠️ **需要修改**: 将 `support@aidictation.com` 替换为你的真实邮箱

### 3. 资源文件
- [x] 应用图标: `client/assets/images/icon.png`
- [x] 启动屏图标: `client/assets/images/splash-icon.png`
- [x] 自适应图标: `client/assets/images/adaptive-icon.png`
- [ ] ⚠️ **建议**: 设计更精美的应用图标和启动屏

### 4. 代码优化
- [x] 生产环境自动移除 console.log
- [x] 保留 console.error 和 console.warn

---

## 四、App Store / Google Play 账号准备

### iOS 发布 (App Store)

1. **注册 Apple Developer 账号**
   - 访问: https://developer.apple.com/programs/
   - 费用: $99/年
   - 需要准备: 身份证/护照、信用卡

2. **创建 App ID**
   - Bundle ID: `com.aidictation.app`
   - 启用能力: Push Notifications (如需要)

3. **创建证书和描述文件**
   - 在 Xcode 或 Apple Developer 后台创建

### Android 发布 (Google Play)

1. **注册 Google Play Console 账号**
   - 访问: https://play.google.com/console
   - 费用: $25 (一次性)
   - 需要准备: Google 账号、信用卡

2. **创建应用**
   - 应用名称: AI听写云
   - 包名: `com.aidictation.app`

---

## 三、构建应用

### 安装 EAS CLI

```bash
npm install -g eas-cli
```

### 登录 Expo 账号

```bash
eas login
```

如果没有 Expo 账号，先在 https://expo.dev 注册。

### 构建 iOS 版本

```bash
cd client

# 构建 iOS 版本（需要 Apple Developer 账号）
eas build --platform ios --profile production

# 或者先构建预览版本测试
eas build --platform ios --profile preview
```

### 构建 Android 版本

```bash
cd client

# 构建 Android AAB (用于 Google Play)
eas build --platform android --profile production

# 构建 APK (用于测试或第三方分发)
eas build --platform android --profile preview
```

### 构建状态查看

```bash
# 查看构建列表
eas build:list

# 查看特定构建详情
eas build:view [BUILD_ID]
```

---

## 四、提交应用商店

### iOS (App Store Connect)

```bash
# 提交到 App Store
eas submit --platform ios --latest
```

或手动上传：
1. 下载构建好的 .ipa 文件
2. 使用 Transporter 上传到 App Store Connect
3. 在 App Store Connect 填写应用信息

### Android (Google Play Console)

```bash
# 提交到 Google Play
eas submit --platform android --latest
```

或手动上传：
1. 下载构建好的 .aab 文件
2. 在 Google Play Console 创建发布版本
3. 上传 .aab 文件

---

## 五、应用商店信息准备

### 应用截图规格

| 平台 | 设备 | 尺寸 |
|------|------|------|
| iOS | iPhone 6.7" | 1290 x 2796 |
| iOS | iPhone 6.5" | 1242 x 2688 |
| iOS | iPhone 5.5" | 1242 x 2208 |
| Android | 手机 | 1080 x 1920 |
| Android | 平板 | 2560 x 1600 |

**建议截图数量**: 每种设备 3-5 张

### 应用描述示例

**简短描述 (80字符内)**:
> 智能英语学习应用，语音识别实时评估发音

**完整描述**:
> AI听写云是一款智能英语学习应用，通过先进的语音识别技术帮助您提升英语口语和听力能力。
>
> 【主要功能】
> • 智能语音识别 - 实时评估您的发音准确性
> • 多种AI音色 - 沉浸式学习体验
> • 错题智能收集 - 针对性复习薄弱环节
> • 学习数据统计 - 追踪进步轨迹
> • 自定义句库 - 个性化学习内容
>
> 【适合人群】
> • 英语学习者
> • 准备考试的学生
> • 想提升口语的职场人士
>
> 立即下载，开启您的英语学习之旅！

### 关键词建议

> 英语学习,英语口语,语音识别,英语听力,单词学习,英语练习,口语练习,英语发音

---

## 六、后端部署

### 环境变量清单

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host:5432/db` |
| `COZE_SUPABASE_URL` | Supabase 地址 | `https://xxx.supabase.co` |
| `COZE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJhbGciOiJI...` |
| `COZE_BUCKET_ENDPOINT_URL` | 对象存储地址 | `https://s3.xxx.com` |
| `COZE_BUCKET_NAME` | 存储桶名称 | `my-bucket` |

### 部署步骤 (云服务器)

1. **购买服务器**
   - 推荐: 阿里云 ECS、腾讯云 CVM
   - 配置: 1核2G 起
   - 系统: Ubuntu 22.04

2. **安装环境**
   ```bash
   # 安装 Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # 安装 PM2
   sudo npm install -g pm2
   ```

3. **上传代码**
   ```bash
   # 方式1: Git clone
   git clone [你的仓库地址]

   # 方式2: SCP 上传
   scp -r server/ user@server:/app/
   ```

4. **启动服务**
   ```bash
   cd server
   pnpm install
   pnpm build

   # 使用 PM2 启动
   pm2 start dist/index.js --name "aidictation-api"
   pm2 save
   pm2 startup
   ```

5. **配置 Nginx 反向代理**
   ```nginx
   server {
       listen 80;
       server_name api.aidictation.com;

       location / {
           proxy_pass http://localhost:9091;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **配置 HTTPS**
   ```bash
   # 使用 Let's Encrypt 免费证书
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.aidictation.com
   ```

---

## 七、更新应用配置

发布前需要更新前端 API 地址：

1. 找到 `client/app.config.ts` 或环境变量配置
2. 将 `EXPO_PUBLIC_BACKEND_BASE_URL` 设置为你的后端地址
3. 例如: `https://api.aidictation.com`

---

## 八、发布后维护

### 版本更新流程

1. 更新 `client/app.config.ts` 中的版本号
2. 执行构建命令
3. 提交到应用商店
4. 填写版本更新说明

### 监控与日志

- 使用 PM2 监控后端服务: `pm2 monit`
- 查看日志: `pm2 logs aidictation-api`
- 配置告警通知

---

## 九、常见问题

### Q: 构建失败怎么办？
A: 查看 EAS 构建日志，常见原因：
- 证书配置错误
- 依赖版本不兼容
- 原生模块问题

### Q: 应用审核被拒？
A: 常见原因：
- 缺少隐私政策链接
- 功能描述不清晰
- 存在崩溃或 bug
- 权限使用说明不充分

### Q: 如何更新后端？
A:
```bash
git pull
pnpm install
pnpm build
pm2 restart aidictation-api
```

---

## 十、联系信息

记得修改以下位置的联系方式：
- [ ] `client/screens/privacy-policy/index.tsx` - 隐私政策邮箱
- [ ] `client/screens/user-agreement/index.tsx` - 用户协议邮箱
- [ ] `client/screens/about/index.tsx` - 关于页面邮箱

---

祝发布顺利！🎉
