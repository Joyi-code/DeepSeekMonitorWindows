# DeepSeek Monitor Windows

DeepSeek Monitor Windows 是一个面向 Windows 的 DeepSeek API 用量监控桌面应用，用于查看账户余额、当月消费、模型 Token 用量和最近用量趋势。

本项目基于 [JayHome137/deepseek-monitor](https://github.com/JayHome137/DeepSeekMonitor) 的开源项目思路做 Windows 系统适配，**感谢原作者 JayHome137 的开源工作**。原项目是 Python Web Dashboard，用于追踪 DeepSeek 平台多类公开变化，原项目当前仅支持mac版本。本项目开发目标是 Windows 桌面端监控工具，技术栈和使用方式已经按 Windows 平台重构实现。

郑重声明：本项目不是 DeepSeek 官方产品。

## About

DeepSeek Monitor Windows: Windows desktop adaptation of felikschu/deepseek-monitor, built with Tauri, React and Rust for DeepSeek balance and usage monitoring.

## 页面截图

![DeepSeek Monitor Windows 页面总览](screenshots/overview.png)

## 当前能力

- 查询 DeepSeek API 账户余额，使用 DeepSeek 官方余额接口。
- 查询 DeepSeek 平台用量数据，包括当月消费、模型 Token 总量、请求数、缓存命中、缓存未命中和输出 Token。
- 支持 V4 Flash 与 V4 Pro 两类模型用量展示。
- 支持最近 7 天消费趋势图和模型详情页。
- 支持 Windows 托盘入口，主窗口默认不进入任务栏。
- 支持 API Key 保存、清除和余额验证。
- 支持用量 Token 自动同步和手动粘贴兜底。
- UI 复用原 macOS 版本的视觉方向，并按 Windows Tauri 窗口做适配。

## 与原项目的关系

| 项目 | 原项目 deepseek-monitor | 本项目 DeepSeekMonitorWindows |
| --- | --- | --- |
| 目标平台 | macOS / Web Dashboard | Windows 桌面端 |
| 核心技术 | Python, Web Server, HTML Dashboard | Tauri 2, React 18, TypeScript, Rust |
| 主要用途 | 追踪 DeepSeek 网页端、Feature Flags、API 端点、法律文档、GitHub 等公开变化 | 查看 DeepSeek API 余额、消费、Token 用量和趋势 |
| 启动方式 | Python 服务 + 浏览器访问 | Windows 桌面应用 |
| 本项目是否复用原事件追踪内容 | 不复用 | 不写入 README，不作为本项目能力声明 |

## 系统要求

- Windows 10 或 Windows 11。
- Microsoft Edge WebView2 Runtime。Windows 11 通常已内置，Windows 10 如缺失需单独安装。
- Node.js 18+ 和 npm。
- Rust 1.77.2+，建议使用 MSVC 工具链。
- Visual Studio Build Tools，需包含 Desktop development with C++ 相关组件。

## 安装与开发

```powershell
git clone <your-repo-url>
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
npm run build
```

Tauri 打包目标当前配置为 NSIS 安装包，产物位于 `src-tauri/target/release/bundle/nsis/`。

## 使用方式

打开应用后进入设置页，先配置 DeepSeek API Key。API Key 用于查询账户余额，来自 DeepSeek 开放平台的 API Keys 页面。

因为DeepSeek 官方未提供相应的API接口，因此用量统计需要网页登录 Token。这个 Token 与 API Key 不同，用于访问 DeepSeek 平台的用量接口。

方式一，网页登录自动同步：

- 点击 `方式一：网页登录自动同步`。
- 在弹出的 DeepSeek 登录窗口完成登录。
- 登录成功后，应用会从 WebView2 缓存中尝试提取平台用量 Token。
- 同步成功后会自动刷新本月消费和 Token 统计。

方式二，手动粘贴 token：

- 点击 `方式二：手动粘贴 token`。
- 按页面提示从浏览器控制台获取 `JSON.parse(localStorage.userToken).value`。
- 粘贴后保存，作为自动同步失败时的兜底方案。

**Token 可能过期。用量查询失败时，重新执行网页登录同步或手动粘贴即可。**

## 数据存储

应用配置默认存储在：

```text
%APPDATA%\DeepSeekMonitorWindows\config.json
```

其中包含 API Key 和用量 Token，凭据已通过 Windows DPAPI 加密存储，不在文件中明文保留。**请不要提交该文件，也不要把截图、日志或配置文件中的密钥内容公开。**

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
│   ├── src/lib.rs               # API 调用、配置存储、凭据加密、托盘、网页登录同步
│   ├── tauri.conf.json          # Tauri 窗口、打包和安全配置（CSP 已启用）
│   ├── Cargo.toml               # Rust 依赖与包信息
│   └── capabilities/            # Tauri 权限配置
│       ├── default.json         # 主窗口权限
│       └── login-sync.json      # 登录窗口最小权限
├── public/assets/               # DeepSeek 图标与静态资源
├── scripts/                     # Windows 开发脚本
├── package.json                 # 前端依赖与脚本
└── README.md                    # 项目说明
```

## 依赖

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

完整发布记录见 GitHub Releases。

### v1.2.0

由 [KerryChia](https://github.com/KerryChia) 开发。

**安全加固：**

- 启用 CSP 内容安全策略，阻止内联脚本注入和外部资源加载。
- API Key 与用量 Token 改为 Windows DPAPI 加密存储，不再明文写入 config.json。
- 关闭 `withGlobalTauri`，阻止外部网页访问 Tauri IPC。
- 登录同步注入脚本增加域名白名单守卫，仅拦截发往 DeepSeek 域名的请求。
- 移除注入脚本中的 `__TAURI__` 辅助通道。
- 登录窗口添加 `on_navigation` 导航限制，仅允许 `platform.deepseek.com` 和 `api.deepseek.com`。
- 拆分 capabilities 权限：`login-sync` 窗口仅保留最小权限，不再开放窗口操作和事件 API。
- API Key 输入增加长度上限（256 字符）和格式警告；用量 Token 增加长度上限（4096 字符）。

**功能改进：**

- 主窗口改为可拉伸调整大小（最小 340×500，最大 600×1200），拉高窗口即可完整查看图表内容无需滚动。

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

DeepSeek 平台页面结构、登录状态、WebView2 缓存和内部用量接口都可能变化，本项目不保证长期可用。**API Key 和用量 Token 已通过 Windows DPAPI 加密存储在本机，但使用者仍需自行承担账号安全、网络请求和数据展示带来的风险。**
