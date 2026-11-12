import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Info,
  KeyRound,
  Power,
  RefreshCw,
  Settings,
  Shirt,
  SunMedium,
  X,
  Zap,
} from "lucide-react";
import "./styles.css";

type ViewName = "dashboard" | "settings" | "detail";
type ModelName = "flash" | "pro";
/** 更新状态：idle 未检查 / current 已是最新 / available 有新版本 / downloading / installing / error */
type UpdateStatus = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "error";
type UpdateProgress = { downloaded: number; total: number | null };
type AppConfig = {
  apiKeyConfigured: boolean;
  apiKeyPreview: string | null;
  usageTokenConfigured: boolean;
  refreshIntervalSeconds: number;
  autoRefreshEnabled: boolean;
  autostart: boolean;
  configPath: string;
};
type BalanceData = {
  isAvailable: boolean;
  currency: string;
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
};
type BalanceState = "loading" | "ok" | "error" | "nokey";

type UsageModel = {
  key: string;
  name: string;
  totalTokens: number;
  requestCount: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  responseTokens: number;
  cost: number;
};
type UsageDay = {
  date: string;
  flashTokens: number;
  flashCacheHit: number;
  flashCacheMiss: number;
  flashResponse: number;
  proTokens: number;
  proCacheHit: number;
  proCacheMiss: number;
  proResponse: number;
  totalTokens: number;
  totalCost: number;
  flashCost: number;
  proCost: number;
};
type ApiKeyDayCost = { time: number; cost: number };
type ApiKeyCostSeries = {
  trackingId: string;
  name: string;
  maskedKey: string;
  model: string;
  totalCost: number;
  days: ApiKeyDayCost[];
};
type UsageResult = {
  models: UsageModel[];
  days: UsageDay[];
  monthCost: number;
};

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtTokensShort = (n: number) => {
  if (n >= 1e8) return (n / 1e6).toFixed(0) + "M";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
};
const fmtMoney = (n: number) => "¥" + n.toFixed(2);
const mmdd = (date: string) => {
  const parts = date.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
};
const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
/** 完整日期时间：2026-11-12 18:31，用于「上次检查」这类时间戳。 */
const fmtDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${dateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const addDays = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
};
const recentUsageDays = (days: UsageDay[], count = 7): UsageDay[] => {
  const source = new Map(days.filter((day) => day.date <= todayStr()).map((day) => [day.date, day]));
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = dateKey(addDays(today, index - count + 1));
    return (
      source.get(date) ?? {
        date,
        flashTokens: 0,
        flashCacheHit: 0,
        flashCacheMiss: 0,
        flashResponse: 0,
        proTokens: 0,
        proCacheHit: 0,
        proCacheMiss: 0,
        proResponse: 0,
        totalTokens: 0,
        totalCost: 0,
        flashCost: 0,
        proCost: 0,
      }
    );
  });
};
const previousMonth = (date: Date) => {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return { month: previous.getMonth() + 1, year: previous.getFullYear() };
};
const fetchMonthUsage = (month: number, year: number) => {
  return invoke<UsageResult>("fetch_usage", { month, year });
};
const fetchCurrentUsage = async () => {
  const now = new Date();
  const current = await fetchMonthUsage(now.getMonth() + 1, now.getFullYear());
  const needsPreviousMonth = addDays(now, -6).getMonth() !== now.getMonth();
  if (!needsPreviousMonth) {
    return current;
  }
  try {
    const previous = previousMonth(now);
    const previousUsage = await fetchMonthUsage(previous.month, previous.year);
    return {
      ...current,
      days: [...previousUsage.days, ...current.days],
    };
  } catch {
    return current;
  }
};

const refreshOptions = [
  { label: "1 分钟", value: 60 },
  { label: "5 分钟", value: 300 },
  { label: "30 分钟", value: 1800 },
  { label: "1 小时", value: 3600 },
];

function App() {
  const [view, setView] = React.useState<ViewName>("dashboard");
  const [model, setModel] = React.useState<ModelName>("flash");

  const [balance, setBalance] = React.useState<BalanceData | null>(null);
  const [balanceState, setBalanceState] = React.useState<BalanceState>("loading");
  const [balanceError, setBalanceError] = React.useState("");

  const [usage, setUsage] = React.useState<UsageResult | null>(null);
  const [usageState, setUsageState] = React.useState<BalanceState>("loading");
  const [usageError, setUsageError] = React.useState("");
  const [apiKeySeries, setApiKeySeries] = React.useState<ApiKeyCostSeries[] | null>(null);
  const [apiKeyState, setApiKeyState] = React.useState<"loading" | "ok" | "error">("loading");

  // ── 版本更新 ──
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>("idle");
  const [updateVersion, setUpdateVersion] = React.useState<string | null>(null);
  const [updateError, setUpdateError] = React.useState("");
  const [updateProgress, setUpdateProgress] = React.useState<UpdateProgress | null>(null);
  const [updateBadgeVisible, setUpdateBadgeVisible] = React.useState(false);
  const [lastCheckAt, setLastCheckAt] = React.useState<Date | null>(null);
  const pendingUpdate = React.useRef<Update | null>(null);

  const checkForUpdate = React.useCallback(async (manual: boolean) => {
    if (manual) {
      setUpdateStatus("checking");
      setUpdateError("");
    }
    try {
      // GitHub 在国内可能不可达，显式给 30 秒超时，避免后台任务长时间挂起。
      const update = await check({ timeout: 30_000 });
      if (!update) {
        pendingUpdate.current = null;
        setUpdateVersion(null);
        setUpdateStatus("current");
        setUpdateBadgeVisible(false);
        return;
      }
      pendingUpdate.current = update;
      setUpdateVersion(update.version);
      setUpdateStatus("available");
      // 同一个版本只提示一次：进过「关于」看过之后，徽标不再出现。
      setUpdateBadgeVisible(localStorage.getItem("update-seen-version") !== update.version);
    } catch (error) {
      pendingUpdate.current = null;
      // 静默检查失败不打扰用户；手动检查只说网络不可达，不给外链。
      if (manual) {
        setUpdateError("网络不可达，请稍后重试");
        setUpdateStatus("error");
      }
    } finally {
      setLastCheckAt(new Date());
    }
  }, []);

  React.useEffect(() => {
    void checkForUpdate(false);
    // 每 24 小时查一次即可；启动时已经查过一次。
    const timer = window.setInterval(() => void checkForUpdate(false), 24 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [checkForUpdate]);

  const installUpdate = React.useCallback(async () => {
    const update = pendingUpdate.current;
    if (!update) {
      return;
    }
    setUpdateStatus("downloading");
    setUpdateError("");
    setUpdateProgress({ downloaded: 0, total: null });
    try {
      await update.downloadAndInstall(
        (event) => {
          if (event.event === "Started") {
            setUpdateProgress({ downloaded: 0, total: event.data.contentLength ?? null });
          } else if (event.event === "Progress") {
            setUpdateProgress((prev) => ({
              downloaded: (prev?.downloaded ?? 0) + event.data.chunkLength,
              total: prev?.total ?? null,
            }));
          } else if (event.event === "Finished") {
            setUpdateStatus("installing");
          }
        },
        // 下载阶段给 3 分钟上限；网络卡住时请求会超时失败，不会一直停在「正在下载」。
        { timeout: 180_000 },
      );
      await relaunch();
    } catch (error) {
      setUpdateError("下载失败，请检查网络后重试");
      setUpdateStatus("error");
    }
  }, []);

  const openSettings = React.useCallback(() => {
    setView("settings");
    if (updateVersion) {
      localStorage.setItem("update-seen-version", updateVersion);
      setUpdateBadgeVisible(false);
    }
  }, [updateVersion]);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = React.useState(60);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(false);

  const loadBalance = React.useCallback(() => {
    setBalanceState("loading");
    void invoke<BalanceData>("fetch_balance")
      .then((data) => {
        setBalance(data);
        setBalanceState("ok");
      })
      .catch((error) => {
        const message = typeof error === "string" ? error : "查询失败";
        setBalanceError(message);
        setBalanceState(message.includes("未配置") ? "nokey" : "error");
      });
  }, []);

  const loadUsage = React.useCallback(() => {
    setUsageState("loading");
    void fetchCurrentUsage()
      .then((data) => {
        setUsage(data);
        setUsageState("ok");
        setUsageError("");
      })
      .catch((error) => {
        const message = typeof error === "string" ? error : "查询失败";
        setUsageError(message);
        setUsage(null);
        setUsageState(message.includes("未配置") ? "nokey" : "error");
      });
  }, []);

  const loadApiKeyUsage = React.useCallback(() => {
    // 平台按 Key 的接口用「秒级时间范围 + 时区偏移」，不是月。
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);

    setApiKeyState("loading");
    void invoke<ApiKeyCostSeries[]>("fetch_api_key_usage", {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      tz: -new Date().getTimezoneOffset() * 60,
    })
      .then((series) => {
        setApiKeySeries(series);
        setApiKeyState("ok");
      })
      .catch(() => {
        // 该接口是平台内部接口，可能无权限；失败时只隐藏「API Key」页签。
        setApiKeySeries(null);
        setApiKeyState("error");
      });
  }, []);

  const refreshAll = React.useCallback(() => {
    loadBalance();
    loadUsage();
    loadApiKeyUsage();
  }, [loadBalance, loadUsage, loadApiKeyUsage]);

  React.useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  React.useEffect(() => {
    void invoke<AppConfig>("get_app_config")
      .then((config) => {
        setRefreshIntervalSeconds(config.refreshIntervalSeconds || 60);
        setAutoRefreshEnabled(config.autoRefreshEnabled);
      })
      .catch(() => {
        setRefreshIntervalSeconds(60);
        setAutoRefreshEnabled(false);
      });
  }, []);

  React.useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }
    const timer = window.setInterval(refreshAll, refreshIntervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, refreshAll, refreshIntervalSeconds]);

  const hideWindow = React.useCallback(() => {
    void invoke("hide_main_window").catch(() => {
      // Browser preview has no Tauri IPC. Keep it non-blocking for visual checks.
    });
  }, []);

  return (
    <div className="stage">
      {view === "dashboard" && (
        <DashboardPanel
          balance={balance}
          balanceState={balanceState}
          balanceError={balanceError}
          usage={usage}
          usageState={usageState}
          usageError={usageError}
          apiKeySeries={apiKeySeries}
          apiKeyState={apiKeyState}
          onRefresh={refreshAll}
          onClose={hideWindow}
          onSettings={openSettings}
          updateAvailable={updateBadgeVisible}
          updateVersion={updateVersion}
          onOpenUpdate={openSettings}
          onDetail={(nextModel) => {
            setModel(nextModel);
            setView("detail");
          }}
        />
      )}
      {view === "settings" && (
        <SettingsPanel
          onUsageLoaded={(nextUsage) => {
            setUsage(nextUsage);
            setUsageState("ok");
            setUsageError("");
            loadApiKeyUsage();
          }}
          onUsageCleared={() => {
            setUsage(null);
            setUsageState("nokey");
            setUsageError("未配置用量 Token");
          }}
          onRefreshIntervalChanged={setRefreshIntervalSeconds}
          onAutoRefreshChanged={setAutoRefreshEnabled}
          updateStatus={updateStatus}
          updateVersion={updateVersion}
          updateError={updateError}
          updateProgress={updateProgress}
          lastCheckAt={lastCheckAt}
          onCheckUpdate={() => void checkForUpdate(true)}
          onInstallUpdate={() => void installUpdate()}
          onBack={() => setView("dashboard")}
        />
      )}
      {view === "detail" && (
        <ModelDetailPanel
          model={model}
          usage={usage}
          usageState={usageState}
          apiKeySeries={apiKeySeries}
          apiKeyState={apiKeyState}
          onBack={() => setView("dashboard")}
        />
      )}
    </div>
  );
}

function BrandIcon({ size = 32 }: { size?: number }) {
  return (
    <div className="brand-icon" style={{ width: size, height: size }}>
      <img src="/assets/deepseek-color.png" alt="DeepSeek" />
    </div>
  );
}

function DashboardPanel({
  balance,
  balanceState,
  balanceError,
  usage,
  usageState,
  usageError,
  apiKeySeries,
  apiKeyState,
  updateAvailable,
  updateVersion,
  onOpenUpdate,
  onRefresh,
  onClose,
  onSettings,
  onDetail,
}: {
  balance: BalanceData | null;
  balanceState: BalanceState;
  balanceError: string;
  usage: UsageResult | null;
  usageState: BalanceState;
  usageError: string;
  apiKeySeries: ApiKeyCostSeries[] | null;
  apiKeyState: "loading" | "ok" | "error";
  updateAvailable: boolean;
  updateVersion: string | null;
  onOpenUpdate: () => void;
  onRefresh: () => void;
  onClose: () => void;
  onSettings: () => void;
  onDetail: (model: ModelName) => void;
}) {
  const [theme, setTheme] = React.useState<string>(
    () => localStorage.getItem("ui-theme") || "dark",
  );
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ui-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };
  const flash = usage?.models.find((item) => item.key === "flash") ?? null;
  const pro = usage?.models.find((item) => item.key === "pro") ?? null;
  const maxTokens = Math.max(flash?.totalTokens ?? 0, pro?.totalTokens ?? 0, 1);
  const today = usage?.days.find((day) => day.date === todayStr()) ?? null;
  const todayCost = usageState === "ok" && today ? today.totalCost : null;
  const monthCost = usageState === "ok" && usage ? usage.monthCost : null;

  return (
    <section className="panel dashboard-panel" data-testid="dashboard-panel">
      <header className="panel-header" data-tauri-drag-region>
        <div className="title-lockup" data-tauri-drag-region>
          <BrandIcon size={36} />
          <h1>DeepSeek Monitor</h1>
        </div>
        <div className="header-actions">
          <button aria-label="刷新" onClick={onRefresh}>
            <RefreshCw size={22} />
          </button>
          <div className="skin-menu-wrap">
            <button
              aria-label="Toggle theme"
              className="skin-toggle"
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              onClick={toggleTheme}
            >
              <Shirt size={21} />
            </button>
          </div>
          <button aria-label="设置" onClick={onSettings}>
            <Settings size={23} />
          </button>
          <button aria-label="关闭" onClick={onClose}>
            <X size={25} />
          </button>
        </div>
      </header>

      <BalanceCard
        balance={balance}
        state={balanceState}
        error={balanceError}
        todayCost={todayCost}
        monthCost={monthCost}
        updateAvailable={updateAvailable}
        updateVersion={updateVersion}
        onUpdateClick={onOpenUpdate}
      />

      <div className="usage-stack">
        <UsageRow
          modelKey="flash"
          data={flash}
          maxTokens={maxTokens}
          state={usageState}
          onClick={() => onDetail("flash")}
        />
        <UsageRow
          modelKey="pro"
          data={pro}
          maxTokens={maxTokens}
          state={usageState}
          onClick={() => onDetail("pro")}
        />
      </div>

      <UsageTrendChart
        usage={usage}
        state={usageState}
        error={usageError}
        apiKeySeries={apiKeySeries}
        apiKeyState={apiKeyState}
      />
    </section>
  );
}

function BalanceCard({
  balance,
  state,
  error,
  todayCost,
  monthCost,
  updateAvailable,
  updateVersion,
  onUpdateClick,
}: {
  balance: BalanceData | null;
  state: BalanceState;
  error: string;
  todayCost: number | null;
  monthCost: number | null;
  updateAvailable: boolean;
  updateVersion: string | null;
  onUpdateClick: () => void;
}) {
  const symbol = balance?.currency === "USD" ? "$" : "¥";
  const amount =
    state === "loading"
      ? "查询中…"
      : state === "nokey"
        ? "未配置"
        : state === "error"
          ? "查询失败"
          : `${symbol}${balance?.totalBalance ?? "0.00"}`;
  const statusText = state === "ok" ? (balance?.isAvailable ? "可用" : "余额不足") : "—";
  const statusOff = state === "ok" && balance != null && !balance.isAvailable;

  return (
    <article className="card balance-card">
      <div className="card-title-row">
        <div className="caption-with-icon">
          <CreditCard size={15} />
          <span>账户余额</span>
        </div>
        <div className="balance-status">
          {updateAvailable && updateVersion ? (
            <button
              type="button"
              className="update-pill"
              title={`发现新版本 v${updateVersion}，点击查看`}
              onClick={onUpdateClick}
            >
              <i />
              v{updateVersion} 可更新
            </button>
          ) : null}
          <div className={`status-pill ${statusOff ? "off" : ""}`}>
            <span />
            {statusText}
          </div>
        </div>
      </div>
      <div className={`balance-amount ${state !== "ok" ? "balance-dim" : ""}`}>{amount}</div>
      {state === "error" && <div className="balance-error">{error}</div>}
      <div className="metric-grid">
        <div className="mini-card">
          <div className="caption-with-icon orange">
            <SunMedium size={15} />
            <span>当日消耗</span>
          </div>
          <strong>{todayCost != null ? fmtMoney(todayCost) : "—"}</strong>
        </div>
        <div className="mini-card">
          <div className="caption-with-icon orange">
            <CalendarDays size={15} />
            <span>本月消费</span>
          </div>
          <strong>{monthCost != null ? fmtMoney(monthCost) : "—"}</strong>
        </div>
      </div>
    </article>
  );
}

function UsageRow({
  modelKey,
  data,
  maxTokens,
  state,
  onClick,
}: {
  modelKey: ModelName;
  data: UsageModel | null;
  maxTokens: number;
  state: BalanceState;
  onClick: () => void;
}) {
  const isFlash = modelKey === "flash";
  const name = isFlash ? "V4.1 Flash" : "V4 Pro";
  const tokensText = data
    ? `${fmtInt(data.totalTokens)} Tokens`
    : state === "loading"
      ? "查询中…"
      : state === "nokey"
        ? "未配置 Token"
        : state === "error"
          ? "用量不可用"
          : "—";
  const cost = data ? fmtMoney(data.cost) : "—";
  const ratio = data && data.cost > 0 ? `${fmtTokensShort(data.totalTokens / data.cost)} T/¥` : "—";
  const width = data ? `${Math.max(2, (data.totalTokens / maxTokens) * 100)}%` : "0%";

  return (
    <button className="card usage-row" onClick={onClick}>
      <div className={`model-badge ${isFlash ? "flash" : "pro"}`}>
        {isFlash ? <Zap size={27} fill="currentColor" /> : <Brain size={25} />}
      </div>
      <div className="usage-main">
        <h2>{name}</h2>
        <div className="token-line">
          <span>{tokensText}</span>
          <div className="progress-track">
            <i className={isFlash ? "flash-fill" : "pro-fill"} style={{ width }} />
          </div>
        </div>
        {data && data.cacheHitTokens + data.cacheMissTokens > 0 && (
          <span className={`cache-hit-rate ${isFlash ? "flash" : "pro"}`}>
            缓存命中{" "}
            {((data.cacheHitTokens / (data.cacheHitTokens + data.cacheMissTokens)) * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="usage-price">
        <strong>{cost}</strong>
        <span>{ratio}</span>
      </div>
    </button>
  );
}

/** 一根堆叠柱里的一段：key 用于 React 列表，hint 是 Key 的脱敏尾号。 */
type TrendSeries = {
  key: string;
  name: string;
  color: string;
  hint?: string;
  values: number[];
};

/** 首页三个页签：模型、API Key、缓存命中（Token 口径）。 */
type TrendTab = "model" | "key" | "cache";

/** API Key 页签的配色，前 5 名 + 「其他」共 6 段。 */
const KEY_PALETTE = ["#4091ff", "#da38f0", "#f5a524", "#2dd4bf", "#f472b6", "#94a3b8"];
const KEY_TOP_N = 5;

/** 把 sk-c2d05***********************1ee6 缩成 sk-c2d05**1ee6，和官网一致。 */
function shortKeyMask(masked: string): string {
  const match = masked.match(/^(sk-[a-zA-Z0-9]{5})\*+([a-zA-Z0-9]{4})$/);
  return match ? `${match[1]}**${match[2]}` : masked;
}

/** 柱子顶部的金额标签，窄柱放不下两位小数，按数量级取 0 或 1 位。 */
function costLabel(value: number): string {
  if (value <= 0) return "";
  return value >= 100 ? `¥${value.toFixed(0)}` : `¥${value.toFixed(1)}`;
}

/** 按 Key 汇总后的当天金额，首页合并所有模型，详情页只取单个模型。 */
type KeyAggregate = {
  trackingId: string;
  name: string;
  maskedKey: string;
  total: number;
  byDate: Map<string, number>;
};

function aggregateKeyStreams(streams: ApiKeyCostSeries[]): KeyAggregate[] {
  const merged = new Map<string, KeyAggregate>();
  for (const stream of streams) {
    let aggregate = merged.get(stream.trackingId);
    if (!aggregate) {
      aggregate = {
        trackingId: stream.trackingId,
        name: stream.name,
        maskedKey: stream.maskedKey,
        total: 0,
        byDate: new Map<string, number>(),
      };
      merged.set(stream.trackingId, aggregate);
    }
    aggregate.total += stream.totalCost;
    for (const day of stream.days) {
      const date = dateKey(new Date(day.time * 1000));
      aggregate.byDate.set(date, (aggregate.byDate.get(date) ?? 0) + day.cost);
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.total - a.total);
}

/** 前 5 名各占一段，剩下的 Key 合并成「其他」。 */
function keyTrendSeries(aggregates: KeyAggregate[], days: { date: string }[]): TrendSeries[] {
  const top = aggregates.slice(0, KEY_TOP_N);
  const rest = aggregates.slice(KEY_TOP_N);
  const series: TrendSeries[] = top.map((aggregate, index) => ({
    key: aggregate.trackingId,
    name: aggregate.name || "未命名 Key",
    color: KEY_PALETTE[index % KEY_PALETTE.length],
    hint: shortKeyMask(aggregate.maskedKey),
    values: days.map((day) => aggregate.byDate.get(day.date) ?? 0),
  }));
  if (rest.length > 0) {
    series.push({
      key: "__other__",
      name: "其他",
      color: KEY_PALETTE[KEY_PALETTE.length - 1],
      hint: `${rest.length} 个 Key`,
      values: days.map((day) =>
        rest.reduce((sum, aggregate) => sum + (aggregate.byDate.get(day.date) ?? 0), 0),
      ),
    });
  }
  return series;
}

function UsageTrendChart({
  usage,
  state,
  error,
  apiKeySeries,
  apiKeyState,
}: {
  usage: UsageResult | null;
  state: BalanceState;
  error: string;
  apiKeySeries: ApiKeyCostSeries[] | null;
  apiKeyState: "loading" | "ok" | "error";
}) {
  const [tab, setTab] = React.useState<TrendTab>("model");
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const MIN_BAR = 3;

  const days = React.useMemo(() => recentUsageDays(usage?.days ?? []), [usage]);

  const modelSeries: TrendSeries[] = [
    { key: "flash", name: "V4.1 Flash", color: "var(--flash)", values: days.map((day) => day.flashCost ?? 0) },
    { key: "pro", name: "V4 Pro", color: "var(--pro)", values: days.map((day) => day.proCost ?? 0) },
  ];

  // 缓存命中：命中 / 未命中 / 输出三种 Token，Flash 与 Pro 合并。
  const cacheSeries: TrendSeries[] = [
    {
      key: "hit",
      name: "输入（命中缓存）",
      color: "#34d399",
      values: days.map((day) => (day.flashCacheHit ?? 0) + (day.proCacheHit ?? 0)),
    },
    {
      key: "miss",
      name: "输入（未命中缓存）",
      color: "var(--orange)",
      values: days.map((day) => (day.flashCacheMiss ?? 0) + (day.proCacheMiss ?? 0)),
    },
    {
      key: "response",
      name: "输出",
      color: "#a78bfa",
      values: days.map((day) => (day.flashResponse ?? 0) + (day.proResponse ?? 0)),
    },
  ];

  // 按 Key 的金额：合并同一 Key 的多个模型，取前 5 名，其余合并成「其他」。
  const keySeries = React.useMemo(
    () => keyTrendSeries(aggregateKeyStreams(apiKeySeries ?? []), days),
    [apiKeySeries, days],
  );

  const keyReady = apiKeyState === "ok" && keySeries.length > 0;
  const keyTabHint =
    apiKeyState === "error"
      ? "当前账号暂不支持按 API Key 查询"
      : apiKeyState === "loading"
        ? "正在加载按 Key 的数据"
        : "最近 7 天没有按 Key 的消费数据";
  const tokenMode = tab === "cache";
  const activeSeries = tab === "key" ? keySeries : tab === "cache" ? cacheSeries : modelSeries;
  const totals = days.map((_, index) =>
    activeSeries.reduce((sum, series) => sum + series.values[index], 0),
  );
  const maxVal = Math.max(...totals, 1);
  const periodTotal = totals.reduce((sum, value) => sum + value, 0);
  const sumHit = cacheSeries[0].values.reduce((sum, value) => sum + value, 0);
  const sumMiss = cacheSeries[1].values.reduce((sum, value) => sum + value, 0);
  const hitRate = sumHit + sumMiss > 0 ? ((sumHit / (sumHit + sumMiss)) * 100).toFixed(0) : "0";
  const formatValue = (value: number) => (tokenMode ? `${fmtInt(value)} tokens` : fmtMoney(value));
  const formatBarValue = (value: number) =>
    tokenMode ? (value > 0 ? fmtTokensShort(value) : "") : costLabel(value);
  const placeholder =
    state === "loading"
      ? "查询中…"
      : state === "nokey"
        ? "未配置用量 Token"
        : state === "error"
          ? error
          : "暂无数据";

  return (
    <article className="card chart-card">
      <div className="card-title-row">
        <div className="caption-with-icon">
          <BarChart3 size={16} className="brand-blue" />
          <span>每日趋势</span>
        </div>
        <div className="chart-tabs" role="tablist" aria-label="用量维度">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "model"}
            className={tab === "model" ? "chart-tab selected" : "chart-tab"}
            onClick={() => setTab("model")}
          >
            调用类型
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "key"}
            className={tab === "key" ? "chart-tab selected" : "chart-tab"}
            onClick={() => setTab("key")}
            disabled={!keyReady}
            title={keyReady ? undefined : keyTabHint}
          >
            API Key
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cache"}
            className={tab === "cache" ? "chart-tab selected" : "chart-tab"}
            onClick={() => setTab("cache")}
          >
            缓存命中
          </button>
        </div>
      </div>

      <div className="chart-sub">
        <span>
          {state !== "ok"
            ? "—"
            : tokenMode
              ? `缓存命中率 ${hitRate}% · 合计 ${fmtTokensShort(periodTotal)}`
              : `7 天合计 ${fmtMoney(periodTotal)}`}
        </span>
        <span className="chart-sub-note">
          {tokenMode ? "Token 口径" : tab === "key" ? "消费前 5 名 + 其他" : "金额（CNY）"}
        </span>
      </div>

      {state === "ok" && tab === "key" && !keyReady ? (
        <div className="chart-placeholder">{keyTabHint}</div>
      ) : state === "ok" && days.length > 0 ? (
        <>
          <div className="bars" onMouseLeave={() => setHoveredIdx(null)}>
            {days.map((day, index) => {
              const total = totals[index];
              const segments = activeSeries.filter((series) => series.values[index] > 0);
              return (
                <div className="bar-column" key={day.date}>
                  {hoveredIdx === index && total > 0 && (
                    <div
                      className={`bar-tooltip${
                        index <= 1 ? " align-left" : index >= days.length - 2 ? " align-right" : ""
                      }`}
                    >
                      <div className="bar-tooltip-head">
                        <span className="bar-tooltip-date">{day.date}</span>
                        <strong>{formatValue(total)}</strong>
                      </div>
                      {segments.map((series) => (
                        <span className="bar-tooltip-row" key={series.key}>
                          <i className="dot" style={{ background: series.color }} />
                          <span className="bar-tooltip-name">
                            {series.name}
                            {series.hint ? <em>{series.hint}</em> : null}
                          </span>
                          <strong>{formatValue(series.values[index])}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="bar-value">{formatBarValue(total)}</span>
                  <div className="bar-slot">
                    <div
                      className="cache-bar"
                      style={{
                        height: `${total > 0 ? Math.max(MIN_BAR, (total / maxVal) * 100) : MIN_BAR}%`,
                      }}
                      onMouseEnter={() => setHoveredIdx(index)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      {total > 0 ? (
                        segments.map((series) => (
                          <i
                            className="seg"
                            key={series.key}
                            style={{ flexGrow: series.values[index], background: series.color }}
                          />
                        ))
                      ) : (
                        <i className="seg empty" />
                      )}
                    </div>
                  </div>
                  <span className="bar-day">{mmdd(day.date)}</span>
                </div>
              );
            })}
          </div>
          {tab !== "key" && (
            <div className="chart-legend-bottom">
              {(tab === "cache" ? cacheSeries : modelSeries).map((series) => (
                <span className="chart-legend-item" key={series.key}>
                  <i className="dot" style={{ background: series.color }} />
                  {series.name}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="chart-placeholder">{placeholder}</div>
      )}
    </article>
  );
}

function SettingsPanel({
  onBack,
  onUsageLoaded,
  onUsageCleared,
  onRefreshIntervalChanged,
  onAutoRefreshChanged,
  updateStatus,
  updateVersion,
  updateError,
  updateProgress,
  lastCheckAt,
  onCheckUpdate,
  onInstallUpdate,
}: {
  onBack: () => void;
  onUsageLoaded: (usage: UsageResult) => void;
  onUsageCleared: () => void;
  onRefreshIntervalChanged: (seconds: number) => void;
  onAutoRefreshChanged: (enabled: boolean) => void;
  updateStatus: UpdateStatus;
  updateVersion: string | null;
  updateError: string;
  updateProgress: UpdateProgress | null;
  lastCheckAt: Date | null;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [status, setStatus] = React.useState("正在读取本地配置");
  const [busy, setBusy] = React.useState(false);
  const [refresh, setRefresh] = React.useState(60);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [autostart, setAutostart] = React.useState(false);
  const [usageToken, setUsageToken] = React.useState("");
  const [usageStatus, setUsageStatus] = React.useState("");
  const [usageSyncing, setUsageSyncing] = React.useState(false);
  const [showManualPaste, setShowManualPaste] = React.useState(false);
  const [appVersion, setAppVersion] = React.useState("1.2.2");
  const configPath = config?.configPath ?? "%APPDATA%\\DeepSeekMonitorWindows\\config.json";

  React.useEffect(() => {
    void invoke<AppConfig>("get_app_config")
      .then((nextConfig) => {
        setConfig(nextConfig);
        setRefresh(nextConfig.refreshIntervalSeconds || 60);
        setAutoRefresh(nextConfig.autoRefreshEnabled);
        setAutostart(nextConfig.autostart);
        setStatus(nextConfig.apiKeyConfigured ? `已配置 ${nextConfig.apiKeyPreview}` : "未配置 API Key");
        setUsageStatus(nextConfig.usageTokenConfigured ? "用量 Token 已配置" : "未配置用量 Token");
      })
      .catch(() => {
        setStatus("浏览器预览模式，未连接本地配置");
      });
  }, []);

  React.useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("1.2.2"));
  }, []);

  const refreshUsageAfterToken = React.useCallback(
    (prefix: string) => {
      setUsageStatus(`${prefix}，正在刷新用量数据…`);
      return fetchCurrentUsage()
        .then((usage) => {
          onUsageLoaded(usage);
          setUsageStatus(`${prefix}，本月消费 ${fmtMoney(usage.monthCost)}`);
          return usage;
        })
        .catch((error) => {
          const message = typeof error === "string" ? error : "用量刷新失败";
          setUsageStatus(`${prefix}，但用量刷新失败：${message}`);
          throw error;
        });
    },
    [onUsageLoaded],
  );

  React.useEffect(() => {
    const unlistenPromise = listen<AppConfig>("usage-token-captured", (event) => {
      setConfig(event.payload);
      setUsageSyncing(false);
      void refreshUsageAfterToken("已通过网页登录自动同步用量 Token");
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [refreshUsageAfterToken]);

  React.useEffect(() => {
    const unlistenPromise = listen("usage-sync-ended", () => {
      setUsageSyncing(false);
      setUsageStatus("登录窗口已关闭，Token 未获取到。可重新点击同步或使用方式二手动粘贴。");
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const pasteApiKey = React.useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text.trim());
      setStatus("已从剪贴板读取");
    } catch {
      setStatus("剪贴板读取失败");
    }
  }, []);

  const saveApiKey = React.useCallback(() => {
    setBusy(true);
    void invoke<AppConfig>("save_api_key", { apiKey })
      .then((nextConfig) => {
        setConfig(nextConfig);
        setApiKey("");
        setStatus("已保存，正在验证 Key…");
        return invoke<BalanceData>("fetch_balance");
      })
      .then((balance) => {
        const symbol = balance.currency === "USD" ? "$" : "¥";
        const tip = balance.isAvailable ? "" : "（余额不足）";
        setStatus(`验证通过，当前余额 ${symbol}${balance.totalBalance}${tip}`);
      })
      .catch((error) => {
        setStatus(typeof error === "string" ? error : "保存或验证失败");
      })
      .finally(() => setBusy(false));
  }, [apiKey]);

  const clearApiKey = React.useCallback(() => {
    setBusy(true);
    void invoke<AppConfig>("clear_api_key")
      .then((nextConfig) => {
        setConfig(nextConfig);
        setApiKey("");
        setStatus("已清除 API Key");
      })
      .catch((error) => {
        setStatus(typeof error === "string" ? error : "清除失败");
      })
      .finally(() => setBusy(false));
  }, []);

  const pasteUsageToken = React.useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUsageToken(text.trim());
      setUsageStatus("已从剪贴板读取");
    } catch {
      setUsageStatus("剪贴板读取失败");
    }
  }, []);

  const startUsageSync = React.useCallback(() => {
    setUsageSyncing(true);
    setUsageStatus("正在打开登录窗口…");
    void invoke<boolean>("start_usage_sync")
      .then((synced) => {
        if (!synced) {
          setUsageStatus("登录完成后，再次点击本按钮即可同步用量（可多点几次）");
        }
        // synced=true 时由 usage-token-captured 事件刷新数据并更新状态
      })
      .catch((error) => {
        setUsageStatus(typeof error === "string" ? error : "打开登录窗口失败");
      })
      .finally(() => {
        // 短暂忙碌后自动恢复可点击，允许用户登录后反复点击触发同步
        window.setTimeout(() => setUsageSyncing(false), 2500);
      });
  }, []);

  const saveUsageToken = React.useCallback(() => {
    setBusy(true);
    void invoke<AppConfig>("save_usage_token", { usageToken })
      .then((nextConfig) => {
        setConfig(nextConfig);
        setUsageToken("");
        setUsageStatus("已保存，正在验证用量 Token…");
        return refreshUsageAfterToken("手动 Token 已保存");
      })
      .catch((error) => {
        setUsageStatus(typeof error === "string" ? error : "保存或验证失败");
      })
      .finally(() => setBusy(false));
  }, [refreshUsageAfterToken, usageToken]);

  const clearUsageToken = React.useCallback(() => {
    setBusy(true);
    void invoke<AppConfig>("clear_usage_token")
      .then((nextConfig) => {
        setConfig(nextConfig);
        setUsageToken("");
        setUsageStatus("已清除用量 Token");
        onUsageCleared();
      })
      .catch((error) => {
        setUsageStatus(typeof error === "string" ? error : "清除失败");
      })
      .finally(() => setBusy(false));
  }, [onUsageCleared]);

  const saveRefreshInterval = React.useCallback(
    (seconds: number) => {
      const previous = refresh;
      setRefresh(seconds);
      onRefreshIntervalChanged(seconds);
      void invoke<AppConfig>("save_refresh_interval", { refreshIntervalSeconds: seconds })
        .then((nextConfig) => {
          setConfig(nextConfig);
          setRefresh(nextConfig.refreshIntervalSeconds || 60);
          onRefreshIntervalChanged(nextConfig.refreshIntervalSeconds || 60);
        })
        .catch(() => {
          setRefresh(previous);
          onRefreshIntervalChanged(previous);
        });
    },
    [onRefreshIntervalChanged, refresh],
  );

  const saveAutoRefreshEnabled = React.useCallback(
    (enabled: boolean) => {
      const previous = autoRefresh;
      setAutoRefresh(enabled);
      onAutoRefreshChanged(enabled);
      void invoke<AppConfig>("save_auto_refresh_enabled", { autoRefreshEnabled: enabled })
        .then((nextConfig) => {
          setConfig(nextConfig);
          setAutoRefresh(nextConfig.autoRefreshEnabled);
          onAutoRefreshChanged(nextConfig.autoRefreshEnabled);
        })
        .catch(() => {
          setAutoRefresh(previous);
          onAutoRefreshChanged(previous);
        });
    },
    [autoRefresh, onAutoRefreshChanged],
  );

  const saveAutostart = React.useCallback((enabled: boolean) => {
    const previous = autostart;
    setAutostart(enabled);
    void invoke<AppConfig>("save_autostart", { autostart: enabled })
      .then((nextConfig) => {
        setConfig(nextConfig);
        setAutostart(nextConfig.autostart);
      })
      .catch(() => setAutostart(previous));
  }, [autostart]);

  return (
    <section className="settings-panel" data-testid="settings-panel">
      <button className="floating-close settings-close" onClick={onBack} aria-label="返回主面板">
        <X size={20} />
      </button>
      <div className="settings-inner">
        <header className="settings-header" data-tauri-drag-region>
          <BrandIcon size={42} />
          <div>
            <h1>DeepSeek Monitor</h1>
            <p>设置</p>
          </div>
        </header>

        <SettingsSection icon={<KeyRound size={15} />} title="API Key">
          <p>用于调用 DeepSeek API 获取余额和用量数据。当前 Windows 版本会保存在应用本地设置中。</p>
          <p className="muted">API Key 只在当前这台 Windows 电脑本地保留。</p>
          <p className="muted config-path">
            <span>本地位置：</span>
            <span>{configPath}</span>
          </p>
          <div className="key-row">
            <input
              aria-label="API Key"
              type="password"
              value={apiKey}
              placeholder={config?.apiKeyConfigured ? "••••••••••••••••••••••••••••••••••••••••••••••••••" : "sk-..."}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <div className="settings-actions">
            <button className="primary" onClick={saveApiKey} disabled={busy || !apiKey.trim()}>
              验证并保存
            </button>
            <span className={config?.apiKeyConfigured ? "configured" : "configured muted-status"}>
              <CheckCircle2 size={17} />
              {config?.apiKeyConfigured ? "已配置" : "未配置"}
            </span>
            <button className="secondary" onClick={clearApiKey} disabled={busy || !config?.apiKeyConfigured}>
              清除 Key
            </button>
          </div>
        </SettingsSection>

        <SettingsSection icon={<BarChart3 size={15} />} title="用量同步 Token">
          <p>用于同步 Token 用量、消费和趋势图。DeepSeek 无官方用量 API，需网页登录 token（与上面的 API Key 不同）。</p>
          <p className="muted">方式一网页登录自动同步</p>
          <div className="settings-actions usage-sync-actions">
            <button className="primary" onClick={startUsageSync} disabled={usageSyncing}>
              {usageSyncing ? "等待登录" : "网页登录自动同步"}
            </button>
            <span className={config?.usageTokenConfigured ? "configured" : "configured muted-status"}>
              <CheckCircle2 size={17} />
              {config?.usageTokenConfigured ? "已配置" : "未配置"}
            </span>
            <button className="secondary" onClick={clearUsageToken} disabled={busy || !config?.usageTokenConfigured}>
              清除 Token
            </button>
          </div>
          <p className="muted">{usageStatus}</p>
          <button
            className="link-button"
            onClick={() => setShowManualPaste((value) => !value)}
          >
            {showManualPaste ? "收起手动粘贴" : "方式二：手动粘贴 token"}
          </button>
          {showManualPaste && (
            <>
              <p className="muted">
                获取：浏览器登录 platform.deepseek.com，按 F12 打开控制台，输入
                JSON.parse(localStorage.userToken).value 回车，复制返回的字符串。
              </p>
              <p className="muted">token 会过期，用量查询失败时重新获取一次即可。</p>
              <div className="key-row">
                <input
                  aria-label="用量 Token"
                  type="password"
                  value={usageToken}
                  placeholder={config?.usageTokenConfigured ? "••••••••••••••••••••••••••••••••••••••••••••••••••" : ""}
                  onChange={(event) => setUsageToken(event.target.value)}
                />
              </div>
              <div className="settings-actions">
                <button className="primary" onClick={saveUsageToken} disabled={busy || !usageToken.trim()}>
                  保存 Token
                </button>
              </div>
            </>
          )}
        </SettingsSection>

        <SettingsSection icon={<Power size={15} />} title="开机自启">
          <p>开启后，每次登录 Windows 时自动启动 DeepSeek Monitor。</p>
          <Toggle label="登录时自动启动" checked={autostart} onChange={saveAutostart} />
        </SettingsSection>

        <SettingsSection icon={<RefreshCw size={15} />} title="自动刷新">
          <p>开启后，按设定周期自动从 DeepSeek API 拉取最新数据。</p>
          <Toggle label="启用自动刷新" checked={autoRefresh} onChange={saveAutoRefreshEnabled} />
          {autoRefresh && (
            <div className="segmented">
              {refreshOptions.map((option) => (
                <button
                  key={option.value}
                  className={refresh === option.value ? "selected" : ""}
                  onClick={() => saveRefreshInterval(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </SettingsSection>

        <SettingsSection icon={<Info size={15} />} title="关于">
          <div className="version-row">
            <span>当前版本</span>
            <strong>v{appVersion}</strong>
          </div>
          <div className="version-row">
            <span>最新版本</span>
            <strong>
              {updateStatus === "available" && updateVersion
                ? `v${updateVersion}`
                : updateStatus === "current"
                  ? `v${appVersion}`
                  : "—"}
            </strong>
          </div>
          <div className="version-row">
            <span>上次检查</span>
            <strong>{lastCheckAt ? fmtDateTime(lastCheckAt) : "尚未检查"}</strong>
          </div>

          {updateStatus === "available" && updateVersion ? (
            <>
              <p className="muted">发现新版本 v{updateVersion}。点击后自动下载安装包，装完会重启应用。</p>
              <button className="settings-action primary" onClick={onInstallUpdate}>
                立即更新
              </button>
            </>
          ) : null}

          {updateStatus === "downloading" ? (
            <>
              <p className="muted">
                {updateProgress?.total
                  ? `正在下载更新… ${Math.min(100, Math.round((updateProgress.downloaded / updateProgress.total) * 100))}%`
                  : `正在下载更新… ${((updateProgress?.downloaded ?? 0) / 1024 / 1024).toFixed(1)} MB`}
              </p>
              <div className="update-progress">
                <i
                  style={{
                    width: updateProgress?.total
                      ? `${Math.min(100, (updateProgress.downloaded / updateProgress.total) * 100)}%`
                      : "30%",
                  }}
                />
              </div>
            </>
          ) : null}

          {updateStatus === "installing" ? (
            <p className="muted">正在安装更新，应用即将自动重启…</p>
          ) : null}

          {updateStatus === "error" && updateError ? (
            <p className="muted">更新失败：{updateError}</p>
          ) : null}

          {updateStatus === "available" ||
          updateStatus === "downloading" ||
          updateStatus === "installing" ? null : (
            <button
              className="settings-action"
              onClick={onCheckUpdate}
              disabled={updateStatus === "checking"}
            >
              {updateStatus === "checking" ? "检查中…" : "检查更新"}
            </button>
          )}
        </SettingsSection>

      </div>
    </section>
  );
}

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i />
    </label>
  );
}

function ModelDetailPanel({
  model,
  usage,
  usageState,
  apiKeySeries,
  apiKeyState,
  onBack,
}: {
  model: ModelName;
  usage: UsageResult | null;
  usageState: BalanceState;
  apiKeySeries: ApiKeyCostSeries[] | null;
  apiKeyState: "loading" | "ok" | "error";
  onBack: () => void;
}) {
  const isFlash = model === "flash";
  const data = usage?.models.find((item) => item.key === model) ?? null;
  const title = isFlash ? "V4.1 Flash" : "V4 Pro";
  const tintClass = isFlash ? "flash" : "pro";
  const cost = data ? fmtMoney(data.cost) : "—";
  const totalText = data ? fmtTokensShort(data.totalTokens) : "—";

  const [tab, setTab] = React.useState<"cache" | "key">("cache");
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const MIN_BAR = 3; // 整根柱子的最小可见高度百分比（含空数据占位）
  const days = recentUsageDays(usage?.days ?? []);

  // 缓存命中：只统计当前模型。
  const cacheSeries: TrendSeries[] = [
    {
      key: "hit",
      name: "输入（命中缓存）",
      color: "#34d399",
      values: days.map((day) => (isFlash ? day.flashCacheHit : day.proCacheHit) ?? 0),
    },
    {
      key: "miss",
      name: "输入（未命中缓存）",
      color: "var(--orange)",
      values: days.map((day) => (isFlash ? day.flashCacheMiss : day.proCacheMiss) ?? 0),
    },
    {
      key: "response",
      name: "输出",
      color: "#a78bfa",
      values: days.map((day) => (isFlash ? day.flashResponse : day.proResponse) ?? 0),
    },
  ];

  // 按 Key：只取当前模型的流水，再按 Key 合并、取前 5 名。
  const keySeries = keyTrendSeries(
    aggregateKeyStreams((apiKeySeries ?? []).filter((stream) => stream.model === model)),
    days,
  );
  const keyReady = apiKeyState === "ok" && keySeries.length > 0;
  const keyTabHint =
    apiKeyState === "error"
      ? "当前账号暂不支持按 API Key 查询"
      : apiKeyState === "loading"
        ? "正在加载按 Key 的数据"
        : "最近 7 天没有该模型的按 Key 消费";

  const tokenMode = tab === "cache";
  const activeSeries = tokenMode ? cacheSeries : keySeries;
  const totals = days.map((_, index) =>
    activeSeries.reduce((sum, series) => sum + series.values[index], 0),
  );
  const maxVal = Math.max(...totals, 1);
  const rangeText =
    days.length > 0 ? `${mmdd(days[0].date)} - ${mmdd(days[days.length - 1].date)}` : "";
  const formatValue = (value: number) => (tokenMode ? `${fmtInt(value)} tokens` : fmtMoney(value));
  const formatBarValue = (value: number) =>
    tokenMode ? (value > 0 ? fmtTokensShort(value) : "") : costLabel(value);

  return (
    <section className="panel detail-panel" data-testid="detail-panel">
      <button className="floating-close" onClick={onBack} aria-label="返回主面板">
        <X size={20} />
      </button>
      <article className="card detail-hero" data-tauri-drag-region>
        <div className={`model-badge large ${tintClass}`}>
          {isFlash ? <Zap size={34} fill="currentColor" /> : <Brain size={33} />}
        </div>
        <div>
          <h1>{title}</h1>
          <p>{cost}</p>
        </div>
      </article>

      <div className="detail-metrics">
        <article className="card metric-card">
          <span>API 请求次数</span>
          <strong className={tintClass}>{data ? fmtInt(data.requestCount) : "—"}</strong>
        </article>
        <article className="card metric-card">
          <span>Tokens</span>
          <strong className={tintClass}>{totalText}</strong>
        </article>
      </div>

      <article className="card detail-chart">
        <div className="detail-chart-head">
          <div>
            <h2>{tokenMode ? "按日 Token 消耗" : "按日消费（API Key）"}</h2>
            <span>{rangeText}</span>
          </div>
          <div className="chart-tabs" role="tablist" aria-label="明细维度">
            <button
              type="button"
              role="tab"
              aria-selected={tokenMode}
              className={tokenMode ? "chart-tab selected" : "chart-tab"}
              onClick={() => setTab("cache")}
            >
              缓存命中
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!tokenMode}
              className={!tokenMode ? "chart-tab selected" : "chart-tab"}
              onClick={() => setTab("key")}
              disabled={!keyReady}
              title={keyReady ? undefined : keyTabHint}
            >
              API Key
            </button>
          </div>
        </div>
        {usageState === "ok" && days.length > 0 && (tokenMode || keyReady) ? (
          <>
            <div className="detail-bars" onMouseLeave={() => setHoveredIdx(null)}>
              {days.map((day, index) => {
                const total = totals[index];
                const segments = activeSeries.filter((series) => series.values[index] > 0);
                return (
                  <div className="detail-bar-column" key={day.date}>
                    {hoveredIdx === index && total > 0 && (
                      <div
                        className={`bar-tooltip${
                          index <= 1 ? " align-left" : index >= days.length - 2 ? " align-right" : ""
                        }`}
                      >
                        <div className="bar-tooltip-head">
                          <span className="bar-tooltip-date">{day.date}</span>
                          <strong>{formatValue(total)}</strong>
                        </div>
                        {segments.map((series) => (
                          <span className="bar-tooltip-row" key={series.key}>
                            <i className="dot" style={{ background: series.color }} />
                            <span className="bar-tooltip-name">
                              {series.name}
                              {series.hint ? <em>{series.hint}</em> : null}
                            </span>
                            <strong>{formatValue(series.values[index])}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                    <span>{formatBarValue(total)}</span>
                    <div className="detail-bar-slot">
                      {/* 柱高按当天合计占最大值的比例；内部各段用 flex-grow 按真实数值分配，比例精确且不溢出 */}
                      <div
                        className="detail-bar-stacked"
                        style={{
                          height: `${total > 0 ? Math.max(MIN_BAR, (total / maxVal) * 100) : MIN_BAR}%`,
                        }}
                        onMouseEnter={() => setHoveredIdx(index)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        {total > 0 ? (
                          segments.map((series) => (
                            <i
                              className="seg"
                              key={series.key}
                              style={{ flexGrow: series.values[index], background: series.color }}
                            />
                          ))
                        ) : (
                          <i className="seg empty" />
                        )}
                      </div>
                    </div>
                    <em>{mmdd(day.date)}</em>
                  </div>
                );
              })}
            </div>
            {tokenMode && (
              <div className="chart-legend-bottom">
                <span className="chart-legend-item"><i className="dot hit" />命中</span>
                <span className="chart-legend-item"><i className="dot miss" />未命中</span>
                <span className="chart-legend-item"><i className="dot response" />输出</span>
              </div>
            )}
          </>
        ) : (
          <div className="chart-placeholder">
            {!tokenMode && !keyReady
              ? keyTabHint
              : usageState === "nokey"
                ? "未配置用量 Token"
                : usageState === "loading"
                  ? "查询中…"
                  : "暂无数据"}
          </div>
        )}
      </article>
    </section>
  );
}

// Apply the saved theme before first render to avoid a flash of the wrong skin.
document.documentElement.setAttribute("data-theme", localStorage.getItem("ui-theme") || "dark");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
