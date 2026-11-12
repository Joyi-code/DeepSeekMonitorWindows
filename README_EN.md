# DeepSeek Monitor Windows

[简体中文](README.md) | [English](README_EN.md)

DeepSeek Monitor Windows is a desktop application for monitoring DeepSeek API usage on Windows. It displays the account balance, monthly spending, model token usage, and recent usage trends.

This project is a Windows adaptation inspired by the open-source project [JayHome137/DeepSeekMonitor](https://github.com/JayHome137/DeepSeekMonitor). **Many thanks to JayHome137 for the original open-source work.** The original project is a macOS menu bar and desktop widget application built with Swift, SwiftUI, AppKit, and WidgetKit. It monitors DeepSeek V4 Flash / Pro balances, token usage, and spending. This project reimplements the application with a Windows-specific technology stack and workflow.

Important: This project is not an official DeepSeek product.

## Screenshots

### Previous UI

![DeepSeek Monitor Windows overview](screenshots/overview.png)

### Current UI

![DeepSeek Monitor Windows current UI](screenshots/new-ui.png)

## Contact

### WeChat

Scan the QR code to add us on WeChat. Please include GitHub in the verification message.

<img src="screenshots/wechat-qrcode.png" alt="WeChat QR code" width="240" height="290">

WeChat ID: `pixel-cafetime`

WeChat Official Account: 像素与咖啡时光

Douyin: 像素与咖啡时光

## Features

- Queries the DeepSeek API account balance through the official balance endpoint.
- Retrieves DeepSeek platform usage data, including monthly spending, total model tokens, request count, cache hits, cache misses, and output tokens.
- Displays usage for V4.1 Flash and V4 Pro.
- The daily trend chart switches between **Call type**, **API Key**, and **Cache hit** dimensions, stacking daily amounts or tokens; the API Key view shows the top five keys and merges the rest into "Other".
- Provides a seven-day spending trend chart and model detail pages.
- Adds a Windows system tray icon while keeping the main window off the taskbar by default.
- Saves, clears, and validates the API key.
- Supports automatic usage token retrieval with manual paste as a fallback.
- Supports in-app updates: the app checks GitHub Releases quietly, shows a new-version pill on the balance card, and installs from Settings → About.
- Adapts the visual design of the original macOS version to a Windows Tauri window.

## Relationship to the Original Project

| Item | Original DeepSeekMonitor | DeepSeekMonitorWindows |
| --- | --- | --- |
| Target platform | macOS menu bar and WidgetKit desktop widget | Windows desktop |
| Core technology | Swift 5.9+, SwiftUI, AppKit, WidgetKit | Tauri 2, React 18, TypeScript, Rust |
| Primary purpose | View DeepSeek balances, spending, token usage, and trends | View DeepSeek API balances, spending, token usage, and trends |
| Launch method | Native macOS application | Windows desktop application |
| Implementation | Native macOS implementation | Reimplemented for the Windows technology stack |

## Download and Install

Users can download and run `DeepSeekMonitorWindows_1.2.1_x64-setup.exe` from [GitHub Releases](https://github.com/Joyi-code/DeepSeekMonitorWindows/releases/latest). You do not need to uninstall an older version before installing an update.

Installer SHA256: `40105BA56F277A51FDC0112E5C0795AA4E9D7F9191C15EC138C234BD4EF757CB`.

Runtime requirements:

- Windows 10 or Windows 11.
- Microsoft Edge WebView2 Runtime. It is generally included with Windows 11. Install it separately on Windows 10 if it is missing.

## Source Development

Development requirements:

- Node.js 18 or later and npm.
- Rust 1.77.2 or later. The MSVC toolchain is recommended.
- Visual Studio Build Tools with the Desktop development with C++ workload.

Source development on Windows requires Visual Studio Build Tools 2022 with the Desktop development with C++ workload. `npm run tauri:dev` and `npm run tauri:check` automatically detect the local Visual Studio Build Tools installation, so no fixed path needs to be configured manually. Before running `npx tauri build`, make sure the Rust MSVC toolchain is available in the current terminal.

```powershell
git clone https://github.com/Joyi-code/DeepSeekMonitorWindows.git
cd DeepSeekMonitorWindows
npm install
npm run tauri:dev
```

Run development checks:

```powershell
npm run tauri:check
```

Build the installer:

```powershell
npx tauri build
```

The current Tauri bundle target is an NSIS installer. Build artifacts are generated in `src-tauri/target/release/bundle/nsis/`.

If you see `Visual Studio Build Tools not found`, install Visual Studio Build Tools 2022 and verify that the Desktop development with C++ workload is selected.

## Usage

Open the application and go to Settings to configure your DeepSeek API key. The API key is used to query the account balance and is available from the API Keys page on the DeepSeek platform.

The current application interface is in Simplified Chinese. The button labels below match the text shown in the application.

DeepSeek does not currently document a public API endpoint for account-level usage statistics. Usage statistics therefore require a usage token obtained through a DeepSeek web login. This token differs from the API key and is used to access the DeepSeek platform usage endpoint.

Method 1: automatic synchronization through web login

- Click `网页登录自动同步`.
- Sign in through the DeepSeek login window.
- After a successful login, the application attempts to extract the usage token from the WebView2 cache.
- After synchronization succeeds, the application automatically refreshes monthly spending and token statistics.

Method 2: manually paste the usage token

- Click `方式二：手动粘贴 token`.
- Follow the on-screen instructions and retrieve `JSON.parse(localStorage.userToken).value` from the browser console.
- Paste and save the token. This method serves as a fallback when automatic synchronization fails.

**The usage token may expire and should be treated as a sensitive session credential. If a usage query fails, repeat the web login synchronization or paste the token again. On a shared computer, clear it with `清除 Token` in Settings after use.**

## Data Storage

The application configuration is stored by default at:

```text
%APPDATA%\DeepSeekMonitorWindows\config.json
```

This file stores the API key and usage token as unencrypted text. **Do not commit, share, or back up this file. Do not expose credentials in screenshots, logs, or configuration files. On a shared computer, clear the API key and usage token in Settings after use.**

The WebView2 login cache is usually stored at:

```text
%LOCALAPPDATA%\com.deepseek.monitor.windows\EBWebView
```

This directory contains local runtime data and should not be committed to the repository.

## Project Structure

```text
DeepSeekMonitorWindows/
├── src/                         # React and TypeScript frontend
│   ├── main.tsx                 # Dashboard, settings, details, and Tauri calls
│   └── styles.css               # Windows desktop UI styles
├── src-tauri/                   # Tauri and Rust backend
│   ├── src/lib.rs               # API calls, config storage, tray, and web login sync
│   ├── tauri.conf.json          # Tauri window, bundle, and security settings
│   ├── Cargo.toml               # Rust dependencies and package metadata
│   └── capabilities/            # Tauri permission configuration
├── public/assets/               # DeepSeek icons and static assets
├── scripts/                     # Windows development scripts
├── package.json                 # Frontend dependencies and scripts
├── README.md                    # Chinese project documentation
└── README_EN.md                 # English project documentation
```

## Files That Must Not Be Committed

The repository `.gitignore` excludes the following content:

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- `.env`, `.env.local`, `.env.*.local`
- `.npmrc`
- `*.log`, `*.err.log`, `*.out.log`
- `test-output/`
- Temporary root screenshots: `dashboard-mvp.png`, `settings-mvp.png`, and `detail-mvp.png`
- WebView2 cache and local runtime configuration
- IDE configuration and operating system temporary files

## Key Dependencies

Frontend runtime dependencies:

- React 18
- React DOM 18
- Tauri JavaScript API 2
- lucide-react

Frontend development dependencies:

- Vite 5
- TypeScript 5
- Tauri CLI 2
- React type definitions

Rust backend dependencies:

- tauri 2.11 with `tray-icon`
- tauri-plugin-log
- tauri-plugin-single-instance for single-instance protection
- reqwest 0.12 with `json`
- serde
- serde_json
- log

## Changelog

See [GitHub Releases](https://github.com/Joyi-code/DeepSeekMonitorWindows/releases) for the complete release history.

### v1.2.1

- Added a 30-second timeout for update checks and a 3-minute timeout for downloads.
- Manual check failures now show a single "network unreachable" message.
- The automatic check interval is now 24 hours; Settings → About shows the last check time.
- Fixed `latest.json` being written with a UTF-8 BOM, which broke parsing.

### v1.2.0

- Replaced the dashboard cache-hit chart with a daily trend chart that switches between **Call type**, **API Key**, and **Cache hit**, with per-segment values in the hover card.
- Model detail pages keep the three-part cache chart and add an **API Key** tab that splits that model's daily spending by key.
- The API Key view shows the top five keys by spending and merges the rest into "Other"; key names include a masked suffix.
- The dashboard window is now 670px tall, increasing the daily chart height by about 70px.
- Added in-app updates: a new-version pill on the balance card and a one-click update in Settings → About; `scripts/release.ps1` builds the installer, signature, and `latest.json`.

### v1.1.1

- Fixed the Flash usage card showing no data after the platform renamed its model identifier to `deepseek-flash`.
- Centralized model matching so `deepseek-flash`, `deepseek-v4-flash`, and `deepseek-chat` all map to the Flash card.
- Renamed the Flash card and detail title to "V4.1 Flash".

### v1.1.0

- Added detailed cache hit, cache miss, and output token statistics.
- Added a light UI theme that can be toggled from the dashboard and persists across sessions.
- Added the current version number to the Settings page.
- GitHub Release `v1.1.0` is marked as Latest. The installer is `DeepSeekMonitorWindows_1.1.0_x64-setup.exe`.
- Installer SHA256: `B13EF28BB7E803D923E1A00BCE4A873B4EB7F2F592AFF690173C2E9291F1D13F`.
- The historical `v1.0.1` release and its installer remain available for rollback and version tracking.

### v1.0.1

- Fixed an issue that allowed multiple application instances to run at the same time. Thanks to Zhuyin from the Douyin community for reporting the bug. Previously, double-clicking the application icon or executable while the application was already running created another process. The `tauri-plugin-single-instance` guard now brings the existing dashboard to the foreground instead of opening another instance.

### v1.0.0

- First stable release with DeepSeek API balance queries, platform usage statistics, spending trends, a Windows system tray entry, and API key and usage token management.

## License

This project is licensed under the MIT License, consistent with the license declared by the original project. See [LICENSE](LICENSE) for details.

## Disclaimer

This project is intended only for learning and research. Follow the DeepSeek terms of use, use the relevant endpoints responsibly, and avoid frequent requests.

DeepSeek page structures, login state, WebView2 cache behavior, and internal usage endpoints may change. Long-term availability is not guaranteed. **API keys and usage tokens are sensitive credentials. Users are responsible for the risks associated with local storage, account security, network requests, and displayed data.**
