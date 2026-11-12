# 发布脚本：构建带签名的 NSIS 安装包，并生成 updater 用的 latest.json
# 用法：powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Notes "本次更新说明"
param(
  [string]$Notes = "更新说明",
  [string]$KeyPath = "D:\codex\keys\deepseek-monitor.key",
  [string]$Repository = "Joyi-code/DeepSeekMonitorWindows"
)

$ErrorActionPreference = "Stop"

. "$PSScriptRoot\env.ps1"
$repo = (Get-Location).Path

$config = Get-Content -LiteralPath (Join-Path $repo "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$version = $config.version
$tag = "v$version"

# 签名私钥保存在仓库外，避免误提交；密码文件与私钥同目录。
if (Test-Path -LiteralPath $KeyPath) {
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -LiteralPath $KeyPath -Raw
  $passwordFile = "$KeyPath.password"
  if (Test-Path -LiteralPath $passwordFile) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
  }
}
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
  throw "找不到签名私钥：$KeyPath。没有它无法生成更新包。"
}

$vsDevCmd = Resolve-VsDevCmd
$cmdFile = Join-Path $env:TEMP "dsm-release-build.cmd"
Set-Content -LiteralPath $cmdFile -Value @"
call "$vsDevCmd" -arch=x64 -host_arch=x64 >nul
cd /d "$repo"
npx tauri build
"@ -Encoding ASCII

cmd /c $cmdFile
if ($LASTEXITCODE -ne 0) {
  throw "tauri build 失败，发布中止"
}

$bundleDir = Join-Path $repo "src-tauri\target\release\bundle\nsis"
$installer = Join-Path $bundleDir "DeepSeekMonitorWindows_${version}_x64-setup.exe"
$signatureFile = "$installer.sig"
if (-not (Test-Path -LiteralPath $installer)) { throw "缺少安装包：$installer" }
if (-not (Test-Path -LiteralPath $signatureFile)) { throw "缺少签名文件：$signatureFile" }

$installerName = Split-Path -Leaf $installer
$downloadUrl = "https://github.com/$Repository/releases/download/$tag/$installerName"

$latest = [ordered]@{
  version = $version
  notes = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = @{
    "windows-x86_64" = @{
      signature = (Get-Content -LiteralPath $signatureFile -Raw).Trim()
      url = $downloadUrl
    }
  }
}
$latestPath = Join-Path $bundleDir "latest.json"
$latest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $latestPath -Encoding utf8

$hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash

Write-Host ""
Write-Host "版本：$version    标签：$tag"
Write-Host "安装包：$installer"
Write-Host "SHA256：$hash"
Write-Host "更新清单：$latestPath"
Write-Host ""
Write-Host "GitHub Release（$tag）需要上传这 3 个文件："
Write-Host "  1. $installerName"
Write-Host "  2. $installerName.sig"
Write-Host "  3. latest.json"
Write-Host ""
Write-Host "注意：latest.json 必须和安装包放在同一个 Release 下，客户端才能自动更新。"
