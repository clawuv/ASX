import { useRef, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  ChartColumn,
  Database,
  Folder,
  Globe,
  History,
  Info,
  KeyRound,
  LayoutGrid,
  PanelLeft,
  Route,
  Server,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import type { AppId } from "@/lib/api";
import type { VisibleApps } from "@/types";
import { APP_IDS } from "@/config/appConfig";
import type { GlobalPage, SettingsSection, View } from "@/lib/navigation";
import { isAppPage } from "@/lib/navigation";
import { SkillsIcon } from "@/components/BrandIcons";
import { useUpdate } from "@/contexts/UpdateContext";
import { sidebarWidth, useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { useSettingsQuery } from "@/lib/query";
import {
  fmtInt,
  formatHitRatePercent,
  formatTokensCompact,
  getLocaleFromLanguage,
  getResolvedLang,
  resolveSidebarToday,
  type SidebarTodayItem,
} from "@/components/usage/format";
import { useSidebarStatus } from "@/hooks/useSidebarStatus";
import { HoverTip } from "@/components/ui/hover-tip";
import { DRAG_REGION_ATTR, DRAG_REGION_STYLE, isMac } from "@/lib/platform";
import { cn } from "@/lib/utils";
import ccswitchLogo from "@/assets/icons/logo.svg";

const NO_DRAG = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

type IconComponent = ComponentType<{ className?: string }>;

interface SidebarProps {
  activeApp: AppId;
  view: View;
  visibleApps: VisibleApps;
  settingsSection: SettingsSection;
  /** 兼容旧调用；智能体合并菜单后侧栏不再直接选单个应用。 */
  onSelectApp?: (app: AppId) => void;
  onSelectPage: (page: GlobalPage | "settings") => void;
  /** 侧栏顶部的导航历史 */
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onSelectSettingsSection: (section: SettingsSection) => void;
  onExitSettings: () => void;
  /** 打开了「启动时检查应用更新」并且查到了新版本 */
  appsUpdateAvailable?: boolean;
}

type DirectoryProps = SidebarProps & { collapsed: boolean };

/**
 * 主导航（v7）：顶条 44 → 智能体入口 → 应用 → 全局页（贴底）→ 底栏「设置」。
 * 进入设置后整条侧栏换成设置目录。收起时是 56px 的图标轨；
 * 展开 / 收起时宽度一步到位，边缘的滑动由盖板的 transform 动画画出（见 useSidebarCollapsed），文字不换行、被裁掉而不是挤成两行。
 * 收起时各行只剩图标，名字由 HoverTip 从右侧报；展开时文字可见，不再挂提示。
 */
export function Sidebar(props: SidebarProps) {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);
  const { collapsed, toggle } = useSidebarCollapsed(navRef);
  const { view } = props;
  const inSettings = view === "settings";
  // macOS 收起后侧栏不占宽度，只把按钮悬浮在原位置；其他平台继续用图标轨。
  const showCollapsedDirectory = !collapsed || !isMac();
  const collapseToOverlay = collapsed && isMac();

  return (
    <nav
      ref={navRef}
      aria-label={t("nav.mainLabel")}
      className={cn(
        "relative flex h-full shrink-0 flex-col whitespace-nowrap text-body text-fg-1",
        collapseToOverlay
          ? "sidebar-overlay-collapsed overflow-visible bg-transparent"
          : // 菜单区深色下透出根节点的窗框渐变（.app-frame-gradient），浅色用侧栏底色
            "sidebar-gradient overflow-hidden bg-sidebar dark:bg-transparent",
      )}
      style={{ width: sidebarWidth(collapsed) }}
    >
      <a
        href="#main-content"
        className="absolute -start-[999px] top-2 z-10 rounded-control bg-surface px-2 py-1 text-caption shadow-v7-sm focus:start-2"
      >
        {t("nav.skipToContent")}
      </a>
      <SidebarTopBar
        collapsed={collapsed}
        onToggle={toggle}
        canNavigateBack={props.canNavigateBack}
        canNavigateForward={props.canNavigateForward}
        onNavigateBack={props.onNavigateBack}
        onNavigateForward={props.onNavigateForward}
      />
      {showCollapsedDirectory ? (
        inSettings ? (
          <SettingsDirectory {...props} collapsed={collapsed} />
        ) : (
          <MainDirectory {...props} collapsed={collapsed} />
        )
      ) : null}
    </nav>
  );
}

function SidebarTopBar({
  collapsed,
  onToggle,
  canNavigateBack,
  canNavigateForward,
  onNavigateBack,
  onNavigateForward,
}: {
  collapsed: boolean;
  onToggle: () => void;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
}) {
  const { t } = useTranslation();
  const tipSide = collapsed ? "right" : "left";
  const label = collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar");
  const Icon = PanelLeft;
  const toggleButton = (
    <HoverTip content={label} side={tipSide} disableHoverableContent>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        style={NO_DRAG}
        className="flex h-7 w-7 items-center justify-center rounded-control text-fg-2 transition-[background-color,color,scale] hover:bg-subtle hover:text-fg-1 active:scale-[0.96]"
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </HoverTip>
  );

  const historyButtons = (
    <>
      <HoverTip
        content={t("common.back")}
        side={tipSide}
        disableHoverableContent
      >
        <button
          type="button"
          onClick={onNavigateBack}
          disabled={!canNavigateBack}
          aria-label={t("common.back")}
          style={NO_DRAG}
          className="flex h-7 w-7 items-center justify-center rounded-control text-fg-2 transition-[background-color,color,scale] hover:bg-subtle hover:text-fg-1 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </HoverTip>
      <HoverTip
        content={t("common.forward")}
        side={tipSide}
        disableHoverableContent
      >
        <button
          type="button"
          onClick={onNavigateForward}
          disabled={!canNavigateForward}
          aria-label={t("common.forward")}
          style={NO_DRAG}
          className="flex h-7 w-7 items-center justify-center rounded-control text-fg-2 transition-[background-color,color,scale] hover:bg-subtle hover:text-fg-1 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </HoverTip>
    </>
  );

  // macOS 展开：红绿灯在左侧，收起按钮贴右侧；标题栏保持一行，不单独显示应用名。
  if (!collapsed && isMac()) {
    return (
      <div
        className="flex h-[52px] shrink-0 items-center justify-start pb-1 ps-[80px]"
        {...DRAG_REGION_ATTR}
        style={DRAG_REGION_STYLE as React.CSSProperties}
      >
        <div className="flex items-center gap-0.5">
          {toggleButton}
          {historyButtons}
        </div>
      </div>
    );
  }

  // 收起后按钮保持展开时的坐标不变；轨道加宽后菜单仍然只显示图标。
  if (collapsed && isMac()) {
    return (
      <div
        className="relative h-[52px] w-0 shrink-0"
        {...DRAG_REGION_ATTR}
        style={DRAG_REGION_STYLE as React.CSSProperties}
      >
        <div className="absolute left-[80px] top-[10px] z-[3]" style={NO_DRAG}>
          <div className="flex items-center gap-0.5">
            {toggleButton}
            {historyButtons}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // 顶条贴住窗口顶（与卡片 mt-0 一致），页头标题保持水平对齐
        "flex h-[52px] shrink-0 items-center gap-0.5 px-2",
        collapsed && "justify-center",
      )}
      {...DRAG_REGION_ATTR}
      style={DRAG_REGION_STYLE as React.CSSProperties}
    >
      {!collapsed && !isMac() && (
        // 左上角品牌（Windows / Linux）：图标 + 名字；me-auto 把收起按钮推到顶条最右端——
        // 一行从左排开，与参考稿的顶栏一致。macOS 左上角留给红绿灯，不放。
        // 图片不接收指针事件，拖它也是在拖窗口。
        // ps-2 与下方菜单项图标（mx-2 + px-2 = 16px）同一条左对齐线
        <span className="pointer-events-none me-auto flex min-w-0 items-center gap-2 ps-2">
          <img
            src={ccswitchLogo}
            alt=""
            draggable={false}
            className="h-[22px] w-[22px] shrink-0"
          />
          <span className="truncate text-strong font-semibold text-fg-1">
            CC Switch
          </span>
        </span>
      )}
      <div className="flex items-center gap-0.5">
        {toggleButton}
        {historyButtons}
      </div>
    </div>
  );
}

// ─── 主目录 ────────────────────────────────────────────────────────────────

function MainDirectory({
  collapsed,
  view,
  visibleApps,
  onSelectPage,
  appsUpdateAvailable = false,
}: DirectoryProps) {
  const { t, i18n } = useTranslation();
  const { moneyShort } = useMoneyFormat();
  const { data: settings } = useSettingsQuery();
  const { hasUpdate } = useUpdate();
  const {
    appStatus,
    todayCost,
    todayTokens,
    todayRequests,
    todayHitRate,
    authNeedsAttention,
  } = useSidebarStatus();
  // 合并成一个菜单后，把所有可见客户端的路由接管异常聚合到这一行提醒
  const agentsNeedAttention = APP_IDS.filter((app) => visibleApps[app]).some(
    (app) => appStatus(app).alert,
  );

  // 选了的项里是 0 的不写（没配定价时金额总是 0）；命中率在今天还没有请求时不写；
  // 全都没有就整个不显示。两项都有时只写数、上下两行（「今日」放进悬停和读屏）：
  // 带上「今日」，换成新台币这类长币种后一行放不下，会把「用量统计」挤成省略号
  const locale = getLocaleFromLanguage(getResolvedLang(i18n));
  const todayValue = (item: SidebarTodayItem): string | null => {
    switch (item) {
      case "cost":
        return todayCost > 0 ? moneyShort(todayCost) : null;
      case "tokens":
        return todayTokens > 0
          ? formatTokensCompact(todayTokens, locale)
          : null;
      case "requests":
        return todayRequests > 0
          ? t("nav.todayRequests", { value: fmtInt(todayRequests, locale) })
          : null;
      case "hitRate":
        return todayRequests > 0
          ? t("nav.todayHitRate", { value: formatHitRatePercent(todayHitRate) })
          : null;
    }
  };
  const todayValues = resolveSidebarToday(settings?.usageDisplay)
    .map(todayValue)
    .filter((part): part is string => part != null);
  const todayText =
    todayValues.length > 0
      ? t("nav.today", { value: todayValues.join(" · ") })
      : undefined;
  const todayTrailing = todayValues.length > 1 ? todayValues : todayText;

  type MainNavItem = {
    page: GlobalPage;
    label: string;
    icon: IconComponent;
    trailing?: string | string[];
    trailingLabel?: string;
    alert?: string;
    title?: string;
  };

  // 上四项平铺；提示词/会话/授权/用量单独成组（展开时带小标题）
  const navItems: MainNavItem[] = [
    {
      page: "agents",
      label: t("nav.agents"),
      icon: Bot,
      alert: agentsNeedAttention ? t("nav.agentsNeedAttention") : undefined,
    },
    {
      page: "apps",
      label: t("nav.apps"),
      icon: LayoutGrid,
      title: appsUpdateAvailable ? t("nav.appsHasUpdate") : t("nav.appsTitle"),
    },
    { page: "mcp", label: "MCP", icon: Server },
    { page: "skills", label: "Skills", icon: SkillsIcon },
  ];
  const navGroup: { label: string; items: MainNavItem[] } = {
    label: t("nav.group.manage"),
    items: [
      { page: "prompts", label: t("nav.prompts"), icon: BookOpen },
      { page: "sessions", label: t("nav.sessions"), icon: History },
      {
        page: "auth",
        label: t("nav.auth"),
        icon: KeyRound,
        alert: authNeedsAttention ? t("nav.authNeedsReauth") : undefined,
      },
      {
        page: "usage",
        label: t("nav.usage"),
        icon: ChartColumn,
        trailing: todayTrailing,
        trailingLabel: todayText,
      },
    ],
  };

  const renderItem = (item: MainNavItem) => (
    <NavItem
      key={item.page}
      collapsed={collapsed}
      selected={
        item.page === "agents"
          ? view === "agents" || isAppPage(view)
          : isGlobalSelected(item.page)
      }
      icon={item.icon}
      label={item.label}
      title={item.title}
      dot={item.page === "apps" && appsUpdateAvailable}
      trailing={item.trailing}
      trailingLabel={item.trailingLabel}
      alert={item.alert}
      onClick={() => onSelectPage(item.page)}
    />
  );

  const isGlobalSelected = (page: GlobalPage) =>
    view === page || (page === "skills" && view === "skillsDiscovery");

  return (
    <>
      {/* 上四项平铺；下方四项成一组，展开时带小标题 */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto overflow-x-hidden pb-2 pt-0.5",
          // 图标轨只有 56 宽，放不下滚动条
          collapsed && "no-scrollbar",
        )}
      >
        {navItems.map(renderItem)}
        {!collapsed && (
          <div
            aria-hidden="true"
            className="mt-3 px-4 pb-1 text-badge text-fg-3"
          >
            {navGroup.label}
          </div>
        )}
        <div
          role="group"
          aria-label={navGroup.label}
          className={cn("flex flex-col gap-y-1", collapsed && "mt-2 pt-2")}
        >
          {navGroup.items.map(renderItem)}
        </div>
      </div>

      {/* 底部固定项前保留分隔线，和目录区明确分开 */}
      <div
        className={cn(
          "my-1.5 h-px shrink-0 bg-border",
          collapsed ? "mx-[18px]" : "mx-4",
        )}
      />

      <div
        className={cn(
          "flex shrink-0 pb-2",
          // 展开时平分底栏宽度；收起时竖排，组内同样保留一点间距
          collapsed ? "flex-col" : "gap-1 px-2",
        )}
      >
        <NavItem
          collapsed={collapsed}
          compact={!collapsed}
          selected={false}
          icon={Settings}
          label={t("nav.settings")}
          title={hasUpdate ? t("nav.settingsHasUpdate") : t("nav.settings")}
          dot={hasUpdate}
          dotTone="success"
          onClick={() => onSelectPage("settings")}
        />
      </div>
    </>
  );
}

function AlertGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      className={className}
    >
      <path d="M12 4v10" />
      <path d="M12 20h.01" />
    </svg>
  );
}

function NavItem({
  collapsed,
  compact = false,
  selected,
  icon: Icon,
  label,
  title,
  trailing,
  trailingLabel,
  alert,
  dot = false,
  dotTone = "neutral",
  endDot = false,
  onClick,
}: {
  collapsed: boolean;
  /** 底栏项：宽度交给父级平分，悬停提示从上方报 */
  compact?: boolean;
  selected: boolean;
  icon: IconComponent;
  label: string;
  title?: string;
  /** 行尾的小字；放不下时在空格处折成两行，给数组时直接上下排 */
  trailing?: string | string[];
  /** 行尾小字的完整说法（读屏和悬停用），行尾只写了数时给 */
  trailingLabel?: string;
  /** 红点：需要处理，内容是给读屏的说明 */
  alert?: string;
  /** 圆点：有更新 */
  dot?: boolean;
  /** 工具更新用中性色（很多人不想追新）；CC Switch 自己的更新用绿色，和工具更新分开 */
  dotTone?: "neutral" | "success";
  /** 圆点放在行尾（设置目录里的「关于」），而不是图标角上 */
  endDot?: boolean;
  onClick: () => void;
}) {
  const ring = selected ? "border-selected" : "border-sidebar";
  const dotFill = dotTone === "success" ? "bg-success" : "bg-fg-1";
  const trailingLines =
    trailing == null ? [] : Array.isArray(trailing) ? trailing : [trailing];
  const accessibleName = [
    label,
    trailingLabel ?? trailingLines.join(" · "),
    alert,
  ]
    .filter(Boolean)
    .join(" · ");
  const glyph = (size: number) => (
    <span aria-hidden="true" className="relative flex shrink-0 text-fg-2">
      <Icon className={size === 20 ? "h-5 w-5" : "h-[18px] w-[18px]"} />
      {dot && (collapsed || !endDot) && (
        <span
          className={cn(
            "absolute -end-1 -top-[3px] h-2.5 w-2.5 rounded-full border-2",
            dotFill,
            ring,
          )}
        />
      )}
      {collapsed && alert && (
        <span
          className={cn(
            "absolute -end-[7px] -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-danger text-action-fg",
            ring,
          )}
        >
          <AlertGlyph className="h-2 w-2" />
        </span>
      )}
    </span>
  );

  if (collapsed) {
    return (
      <HoverTip
        content={title ?? accessibleName}
        side="right"
        disableHoverableContent
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={title ?? accessibleName}
          aria-current={selected ? "page" : undefined}
          className={cn(
            "mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-sidebar-hover",
            selected && "bg-selected hover:bg-selected",
          )}
        >
          {glyph(20)}
        </button>
      </HoverTip>
    );
  }

  // 展开时名字可见；只有 title 比名字多说了点什么（如「有可用更新」），
  // 或行尾只写了数（完整说法在 trailingLabel）时才挂提示
  const hoverContent =
    title && title !== label
      ? title
      : trailingLabel
        ? accessibleName
        : undefined;
  return (
    <HoverTip
      content={hoverContent}
      side={compact ? "top" : "right"}
      disableHoverableContent
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={trailingLabel ? accessibleName : undefined}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "flex h-8 shrink-0 items-center gap-2 rounded-control px-2 text-start transition-colors hover:bg-sidebar-hover",
          compact ? "min-w-0 flex-1" : "mx-2 w-[184px]",
          selected && "bg-selected font-medium hover:bg-selected",
        )}
      >
        {glyph(18)}
        {trailingLines.length === 0 ? (
          <span className="min-w-0 flex-1 truncate">{label}</span>
        ) : (
          <>
            {/* 有行尾小字时名字不让：放不下就让小字折行（两行正好塞进 32px 的行高） */}
            <span className="shrink-0 grow">{label}</span>
            <span className="min-w-0 text-end text-caption leading-[13px] tabular-nums text-fg-3">
              {trailingLines.map((line) => (
                <span
                  key={line}
                  className={
                    trailingLines.length > 1
                      ? "block whitespace-nowrap"
                      : undefined
                  }
                >
                  {line}
                </span>
              ))}
            </span>
          </>
        )}
        {alert && (
          <span
            role="img"
            aria-label={alert}
            title={alert}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
          />
        )}
        {dot && endDot && (
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFill)}
          />
        )}
      </button>
    </HoverTip>
  );
}

// ─── 设置目录 ──────────────────────────────────────────────────────────────

const SETTINGS_ITEMS: { section: SettingsSection; icon: IconComponent }[] = [
  { section: "general", icon: SlidersHorizontal },
  { section: "appConfig", icon: Folder },
  { section: "routing", icon: Route },
  { section: "network", icon: Globe },
  { section: "data", icon: Database },
  { section: "about", icon: Info },
];

function SettingsDirectory({
  collapsed,
  settingsSection,
  onSelectSettingsSection,
  onExitSettings,
}: DirectoryProps) {
  const { t } = useTranslation();
  const { hasUpdate } = useUpdate();
  const { data: version } = useQuery({
    queryKey: ["app-version"],
    queryFn: () => getVersion(),
    staleTime: Infinity,
  });

  return (
    <>
      {/* 设置目录复用主导航的行高、行宽和间距，避免进入设置后整列突然变小 */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto overflow-x-hidden pb-2 pt-0.5",
          // 图标轨只有 56 宽，放不下滚动条
          collapsed && "no-scrollbar",
        )}
      >
        <NavItem
          collapsed={collapsed}
          selected={false}
          icon={ArrowLeft}
          label={t("nav.back")}
          onClick={onExitSettings}
        />
        {!collapsed && (
          <div
            aria-hidden="true"
            className="mt-3 px-4 pb-1 text-badge text-fg-3"
          >
            {t("nav.settings")}
          </div>
        )}
        <div
          role="group"
          aria-label={t("nav.settings")}
          className="flex flex-col gap-y-1"
        >
          {SETTINGS_ITEMS.map(({ section, icon }) => (
            <NavItem
              key={section}
              collapsed={collapsed}
              selected={settingsSection === section}
              icon={icon}
              label={t(`settings.sections.${section}`)}
              dot={section === "about" && hasUpdate}
              dotTone="success"
              endDot
              title={
                section === "about" && hasUpdate
                  ? t("nav.settingsHasUpdate")
                  : undefined
              }
              onClick={() => onSelectSettingsSection(section)}
            />
          ))}
        </div>
      </div>
      {!collapsed && version && (
        <div className="shrink-0 px-4 pb-4 text-caption text-fg-3">
          CC Switch v{version}
        </div>
      )}
    </>
  );
}

export type { SidebarProps };
