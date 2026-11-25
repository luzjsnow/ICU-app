# ICU 泵助手（重症微量泵配比、走速换算与用药速查）

面向重症医学科（ICU）医师的**纯离线、零隐私上传**本地临床辅助工具，一套代码同时支持 **iOS（Scriptable 免签名永不过期）** 与 **Android（独立 APK）**。

仓库地址：https://github.com/luzjsnow/ICU-app

---

## 扫码下载

| 最新版下载页（推荐 · 安卓 + iOS） | Android APK 直链下载 | GitHub 仓库主页 |
| :---: | :---: | :---: |
| <img src="docs/qr-releases.png" width="180" alt="Releases 扫码下载" /> | <img src="docs/qr-apk.png" width="180" alt="Android APK 扫码直连下载" /> | <img src="docs/qr-repo.png" width="180" alt="GitHub 仓库二维码" /> |
| [前往 Releases 下载页](https://github.com/luzjsnow/ICU-app/releases/latest) | [直接下载 APK](https://github.com/luzjsnow/ICU-app/releases/latest/download/ICU-Pump-Assistant.apk) | [访问仓库主页](https://github.com/luzjsnow/ICU-app) |

> **提示**：使用微信「扫一扫」如遇无法直接下载 `.apk`，请点击右上角 **`···` → 在默认浏览器中打开** 即可顺利下载安装。首次推送代码到 GitHub 后，Actions 工作流会自动编译并创建 Releases 附件。

---

## 核心功能

1. **微量泵双向实时换算（50 mL 为主，兼容 20/100/250/500 mL）**
   - 同时支持**固定配比法**（常用优先）与经典**体重系数配法**（`0.3×kg`、`3×kg` 等）。
   - 支持全量 ICU 单位互转（`μg/kg/min`、`μg/kg/h`、`mg/kg/h`、`μg/min`、`mg/h`、`U/min`、`U/h`、`g/h` 等）。
   - 内置剂量安全区间进度条与高危极量红/橙预警，提供 `±0.1 / ±0.5 / ±1 mL/h` 走速微调。
2. **浓缩/限液换泵 & 续泵剩余时间**
   - 保持当前给药剂量严格不变，一键对比 **0.5× / 1× / 2× / 4× / 自定义浓度** 新配比、等效新泵速与 24h 节液量。
   - 输入注射器当前剩余液量，直接推算还可维持时长与预计打完时刻（方便夜班提前备泵）。
3. **单患者多路微泵汇总面板（零患者隐私）**
   - 仅记录当前参考体重（无姓名/床号），一键叠加多路微泵，实时汇总：
     - **微泵总入液速率（`mL/h`）与 24h 折算液量**
     - **去甲肾上腺素等效剂量（NEE，Goradia 2021 / Kotani 2023）**
     - **血管活性-正性肌力评分（VIS，Gaies 2010）**
   - 支持单路一键 `2× 浓缩减液` 与复制交班摘要文本。
4. **内置 63 种 ICU 高频与常用泵注药库 + 科室自主维护**
   - 涵盖血管活性与正性肌力、镇痛、镇静、肌松、降压扩血管、抗心律失常、抗凝止血、内分泌与电解质、利尿/消化/呼吸等 10 大类。
   - 支持中文/英文/商品名/拼音首字母秒搜（如 `qj` → 去甲肾上腺素）。
   - 支持本科室逐药标记“已核对”、编辑默认配比、新增自定义药物，以及 JSON 备份导入导出与 Excel CSV 核对总表导出。

---

## 一、iPhone 安装指南（Scriptable 离线搭载）

1. 在 iPhone App Store 免费下载安装 **Scriptable**。
2. 执行构建生成离线脚本（或直接使用本项目已生成的 `dist-scriptable/ICU泵助手.js`）：
   ```bash
   npm run build:scriptable
   ```
3. 将 `dist-scriptable/ICU泵助手.js` 通过微信/隔空投送/iCloud Drive 传到 iPhone：
   - 点击该 `.js` 文件 → 右上角分享 → 选择 **拷贝到 Scriptable**（或直接放入 iCloud Drive 的 `Scriptable` 文件夹）。
4. 在 Scriptable 中点击 **ICU泵助手** 即可全屏离线使用！
5. **（推荐）添加到 iPhone 主屏幕像原生 App 一样一键打开**：
   - 打开 iPhone 自带 **快捷指令（Shortcuts）** → 右上角 `+` → 添加操作 → 搜索 **Scriptable** → 选择 **Run Script（运行脚本）** → 选中 `ICU泵助手` → 展开关闭“在运行脚本时显示”→ 点底部/顶部分享 → **添加到主屏幕**，选个医疗图标即完成！

---

## 二、Android APK 安装包获取方式

### 方式 1：GitHub Actions 免费云端一键编出 APK（无需本地装 Android Studio）
1. 将本项目推送到您自己的 GitHub 仓库（私有仓库即可）。
2. 打开仓库的 **Actions** 页面 → 运行 **Build Android APK & iOS Scriptable** 工作流。
3. 等待约 3 分钟，在工作流底部的 **Artifacts** 下载 `ICU-Pump-Android-APK`，解压得到 `app-debug.apk` 传到安卓手机直接安装即可。

### 方式 2：Windows 本机直接编译 APK
如本机已安装 JDK 17 与 Android Studio（配置好 `ANDROID_HOME`）：
```bash
npm run build
npx cap add android   # 首次初始化安卓工程
npx cap sync android
cd android && ./gradlew assembleDebug
```
生成的安装包位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 三、开发与测试命令

```bash
npm install               # 安装依赖
npm run dev               # 本地浏览器实时预览调试
npm test                  # 运行核心计算引擎与全量药库单元测试
npm run build:scriptable  # 构建 iOS Scriptable 独立脚本 (dist-scriptable/ICU泵助手.js)
npm run build:all         # 同时构建 Web/Android 资源与 iOS Scriptable 脚本
```

---

## 临床安全免责声明

本工具仅作为重症临床计算与个人速查辅助，**不能替代医院 HIS/医嘱系统、药品说明书或医师独立临床判断**。不同厂家药品规格、盐基折算（如重酒石酸去甲肾上腺素 vs 游离碱）及本科室稀释规范存在差异，临床给药前请务必严格执行双人核对制度。
