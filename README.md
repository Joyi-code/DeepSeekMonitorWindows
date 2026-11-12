# DeepSeek Monitor Windows

[简体中文](README.md) | [English](README_EN.md)

DeepSeek Monitor Windows 是一个面向 Windows 的 DeepSeek API 用量监控桌面应用，用于查看账户余额、当月消费、模型 Token 用量和最近用量趋势。

本项目基于 [JayHome137/DeepSeekMonitor](https://github.com/JayHome137/DeepSeekMonitor) 的开源项目思路做 Windows 系统适配，**感谢原作者 JayHome137 的开源工作**。原项目是使用 Swift、SwiftUI、AppKit 和 WidgetKit 开发的 macOS 菜单栏与桌面小组件应用，用于监控 DeepSeek V4 Flash / Pro 的账户余额、Token 用量和消费情况。本项目面向 Windows 桌面端，技术栈和使用方式已经按 Windows 平台重构实现。

郑重声明：本项目不是 DeepSeek 官方产品。

## About

DeepSeek Monitor Windows is a Windows desktop adaptation inspired by JayHome137/DeepSeekMonitor. It is built with Tauri, React, TypeScript, and Rust to monitor DeepSeek balances and usage.

## 页面截图

### 旧版本 UI

![DeepSeek Monitor Windows 页面总览](screenshots/overview.png)

### 新版本 UI

![DeepSeek Monitor Windows 新版本 UI](screenshots/new-ui.png)

## 联系方式

### 微信交流

扫码添加微信（备注 GitHub）：

<img src="screenshots/wechat-qrcode.png" alt="微信二维码" width="240" height="290">

微信号：`pixel-cafetime`

微信公众号：像素与咖啡时光

抖音号：像素与咖啡时光

## 当前能力

- 查询 DeepSeek API 账户余额，使用 DeepSeek 官方余额接口。
- 查询 DeepSeek 平台用量数据，包括当月消费、模型 Token 总量、请求数、缓存命中、缓存未命中和输出 Token。
- 支持 V4.1 Flash 与 V4 Pro 两类模型用量展示。
- 主面板「每日趋势」图支持「调用类型 / API Key / 缓存命中」三种维度切换，按天堆叠金额或 Token；API Key 维度取消费前 5 名并合并「其他」。
- 支持最近 7 天消费趋势图和模型详情页。
- 支持 Windows 托盘入口，主窗口默认不进入任务栏。
- 支持 API Key 保存、清除和余额验证。
- 支持用量 Token 自动同步和手动粘贴兜底。
- 支持应用内版本更新：启动时静默检查 GitHub Release，余额卡提示新版本，设置 → 关于可一键下载安装并重启。
- UI 复用原 macOS 版本的视觉方向，并按 Windows Tauri 窗口做适配。

## 与原项目的关系

| 项目 | 原项目 deepseek-monitor | 本项目 DeepSeekMonitorWindows |
| --- | --- | --- |
| 目标平台 | macOS 菜单栏与 WidgetKit 桌面小组件 | Windows 桌面端 |
| 核心技术 | Swift 5.9+、SwiftUI、AppKit、WidgetKit | Tauri 2、React 18、TypeScript、Rust |
| 主要用途 | 查看 DeepSeek 余额、消费、Token 用量和趋势 | 查看 DeepSeek API 余额、消费、Token 用量和趋势 |
| 启动方式 | macOS 原生应用 | Windows 桌面应用 |
| 实现方式 | 原生 macOS 实现 | 按 Windows 技术栈重新实现 |

## 下载安装

普通用户可从 [GitHub Releases](https://github.com/Joyi-code/DeepSeekMonitorWindows/releases/latest) 下载并运行 `DeepSeekMonitorWindows_1.1.0_x64-setup.exe`。覆盖安装新版本前无需卸载旧版本。

安装包 SHA256：`B13EF28BB7E803D923E1A00BCE4A873B4EB7F2F592AFF690173C2E9291F1D13F`。

运行环境要求：

- Windows 10 或 Windows 11。
- Microsoft Edge WebView2 Runtime。Windows 11 通常已内置，Windows 10 如缺失需单独安装。

## 源码开发

开发环境要求：

- Node.js 18+ 和 npm。
- Rust 1.77.2+，建议使用 MSVC 工具链。
- Visual Studio Build Tools，需包含 Desktop development with C++ 相关组件。

Windows 源码开发需要安装 Visual Studio Build Tools 2022，并勾选 `Desktop development with C++`。`npm run tauri:dev` 和 `npm run tauri:check` 会自动探测本机 VS Build Tools 安装位置，无需手动配置固定路径。执行 `npx tauri build` 时，需确保当前终端可以使用 Rust MSVC 工具链。

```powershell
git clone https://github.com/Joyi-code/DeepSeekMonitorWindows.git
cd DeepSeekMonitorWindows
npm install
npm run tauri:dev
```

开发检查：

```powershell
npm run tauri:check
```

构建安装包：

```powershell
npx tauri build
```

Tauri 打包目标当前配置为 NSIS 安装包，产物位于 `src-tauri/target/release/bundle/nsis/`。

如果出现 `Visual Studio Build Tools not found`，请安装 Visual Studio Build Tools 2022，并确认已勾选 `Desktop development with C++` 组件。

## 使用方式

打开应用后进入设置页，先配置 DeepSeek API Key。API Key 用于查询账户余额，来自 DeepSeek 开放平台的 API Keys 页面。

DeepSeek 当前未公开记录账户级用量统计的 API 接口，因此用量统计需要通过网页登录获取用量 Token。用量 Token 与 API Key 不同，用于访问 DeepSeek 平台的用量接口，应按敏感会话凭据管理。

方式一，网页登录自动同步：

- 点击 `方式一：网页登录自动同步`。
- 在弹出的 DeepSeek 登录窗口完成登录。
- 登录成功后，应用会从 WebView2 缓存中尝试提取用量 Token。
- 同步成功后会自动刷新本月消费和 Token 统计。

方式二，手动粘贴用量 Token：

- 点击 `方式二：手动粘贴 token`。
- 按页面提示从浏览器控制台获取 `JSON.parse(localStorage.userToken).value`。
- 粘贴后保存，作为自动同步失败时的兜底方案。

**用量 Token 可能过期。用量查询失败时，重新执行网页登录同步或手动粘贴即可。**

## 数据存储

应用配置默认存储在：

```text
%APPDATA%\DeepSeekMonitorWindows\config.json
```

其中包含未加密存储的 API Key 和用量 Token。**请不要提交、分享或备份该文件，也不要把截图、日志或配置文件中的密钥内容公开。使用共享电脑时，应在设置页清除 API Key 和用量 Token。**

WebView2 登录缓存通常位于：

```text
%LOCALAPPDATA%\com.deepseek.monitor.windows\EBWebView
```

该目录属于本机运行数据，不应提交到仓库。

## 项目结构

```text
DeepSeekMonitorWindows/
├── src/                         # React + TypeScript 前端
│   ├── main.tsx                 # 主界面、设置页、详情页和 Tauri 调用
│   └── styles.css               # Windows 桌面 UI 样式
├── src-tauri/                   # Tauri + Rust 后端
│   ├── src/lib.rs               # API 调用、配置存储、托盘、网页登录同步
│   ├── tauri.conf.json          # Tauri 窗口、打包和安全配置
│   ├── Cargo.toml               # Rust 依赖与包信息
│   └── capabilities/            # Tauri 权限配置
├── public/assets/               # DeepSeek 图标与静态资源
├── scripts/                     # Windows 开发脚本
├── package.json                 # 前端依赖与脚本
├── README.md                    # 中文项目说明
└── README_EN.md                 # 英文项目说明
```

## 不应提交的文件

仓库已通过 `.gitignore` 忽略以下内容：

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- `.env`, `.env.local`, `.env.*.local`
- `.npmrc`
- `*.log`, `*.err.log`, `*.out.log`
- `test-output/`
- 根目录临时截图 `dashboard-mvp.png`, `settings-mvp.png`, `detail-mvp.png`
- WebView2 缓存和本地运行配置
- IDE 配置和系统临时文件

## 主要依赖

前端运行依赖：

- React 18
- React DOM 18
- Tauri JavaScript API 2
- lucide-react

前端开发依赖：

- Vite 5
- TypeScript 5
- Tauri CLI 2
- React 类型定义

Rust 后端依赖：

- tauri 2.11，启用 tray-icon
- tauri-plugin-log
- tauri-plugin-single-instance，单实例守卫，防止应用重复多开
- reqwest 0.12，启用 json
- serde
- serde_json
- log

## 更新日志

完整发布记录见 [GitHub Releases](https://github.com/Joyi-code/DeepSeekMonitorWindows/releases)。

### v1.2.0

- 主面板底部图改为「每日趋势」，提供调用类型 / API Key / 缓存命中三个页签，按天堆叠金额或 Token，悬停显示分段明细。
- 模型详情页保留「缓存命中」三段式图，并新增「API Key」页签，按 Key 拆分该模型的每日消费。
- API Key 维度取区间消费前 5 名，其余合并为「其他」；Key 名称旁显示脱敏尾号。
- 移除主面板「缓存命中明细」图；缓存命中改为第三个页签。
- 主面板窗口高度调整为 670，底部柱状图比原来高约 1 倍。
- 新增应用内版本更新：余额卡提示新版本，设置 → 关于可一键更新；发布用 `scripts/release.ps1` 生成安装包、签名和 `latest.json`。

### v1.1.1

- 修复平台把 Flash 模型标识改为 `deepseek-flash` 后，主面板 Flash 卡片取不到数据的问题。
- 模型归类改为统一入口，兼容 `deepseek-flash`、`deepseek-v4-flash`、`deepseek-chat` 等历史标识。
- 模型卡片与详情页标题改为「V4.1 Flash」。

### v1.1.0

- 支持缓存命中、缓存未命中与输出 Token 的明细显示。
- 增加亮色 UI 皮肤，支持在主面板一键切换并记住用户选择。
- 设置页增加当前版本号显示。
- 当前 GitHub Release `v1.1.0` 已标记为 Latest，安装包为 `DeepSeekMonitorWindows_1.1.0_x64-setup.exe`。
- 安装包 SHA256：`B13EF28BB7E803D923E1A00BCE4A873B4EB7F2F592AFF690173C2E9291F1D13F`。
- 历史 Release `v1.0.1` 和旧安装包继续保留，便于回退和版本追溯。

### v1.0.1

- 修复应用单实例缺失导致的重复多开问题，感谢抖音粉丝群烛阴兄弟提出的bug。此前在程序已运行的情况下再次点击图标或 exe，会不断启动新的进程；现在再次启动时不再新开窗口，而是将已有主面板唤到前台。通过接入 `tauri-plugin-single-instance` 单实例守卫实现。

### v1.0.0

- 首个正式发布版本，提供 DeepSeek API 余额查询、平台用量统计、消费趋势、Windows 托盘入口、API Key 与用量 Token 管理等能力。

## 许可证

本项目使用 MIT License，与原项目 README 中声明的许可证保持一致。详见 [LICENSE](LICENSE)。

## 免责声明

本项目仅用于学习和研究目的。请遵守 DeepSeek 的使用条款，合理使用相关接口，避免频繁请求。

DeepSeek 平台页面结构、登录状态、WebView2 缓存和内部用量接口都可能变化，本项目不保证长期可用。**API Key 和用量 Token 属于敏感凭据，使用者需自行承担本机存储、账号安全、网络请求和数据展示带来的风险。**
