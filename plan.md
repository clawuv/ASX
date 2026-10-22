现在我对代码库有了深入了解。基于实际架构做具体的 feature 规划：

---

# CC Switch 功能规划（基于代码库分析）

## 📐 现有架构关键事实

| 事实 | 位置 | 意义 |
|---|---|---|
| 本地代理基于 **Axum + hyper**，端口 15721 | `src-tauri/src/proxy/server.rs` | 已有完整 HTTP 网关，可以扩展 |
| 已有**熔断器**（Closed/Open/HalfOpen） | `proxy/circuit_breaker.rs` | 无需从零建故障检测 |
| 已有**故障转移队列**（线性顺序 P1→P2→...） | `proxy/provider_router.rs` + `dao/failover.rs` | 升级为路由组的基础 |
| 已有**Session ID 提取**（Claude/Codex/Grok 等） | `proxy/session.rs` | **可做 sticky session，当前未用** |
| 已有**协议转换**（Anthropic↔OpenAI Chat↔Responses↔Gemini） | `proxy/providers/transform_*.rs` | 订阅桥接的技术前提已具备 |
| 已有 **Profile**（Claude/ClaudeDesktop/Codex 三组） | `services/profile.rs` + `dao/profiles.rs` | 可扩展 |
| 已有**用量日志**（`proxy_request_logs` + `usage_daily_rollups`） | `proxy/usage/` | 意图路由的数据基础 |
| 托盘面板已有 Config/Usage 双 Tab | `src/tray-panel/` | 可加 Quick Switcher |
| 无 CLI / 无 TUI / 无嵌套路由组 | — | 差距 |

---

## 🎯 规划总览

```
Phase 1（短期，1-2 Sprint）
  ├── F1  Sticky Session（会话粘滞故障转移）
  ├── F2  托盘 Quick Switcher（⌘K 模糊搜索）
  ├── F3  路由组（Routing Groups，替代线性队列）
  └── F4  从 Magpie 导入配置

Phase 2（中期，3-6 Sprint）
  ├── F5  意图路由（Intent Routing）
  ├── F6  CLI 二进制（ccswitch 命令）
  ├── F7  配额预热定时器
  └── F8  多账号轮换

Phase 3（长期）
  ├── F9  订阅桥接（Claude 订阅 → Codex）
  ├── F10 插件网关中间件
  └── F11 远程 Web UI
```

---

## Phase 1：短期（利用现有代码，快速补齐差距）

### F1 — Sticky Session（会话粘滞）

**对标 Magpie**：同一会话保持同一后端，避免 prompt cache 失效后第一轮费用翻倍。

**改动点**：
- `proxy/forwarder.rs`：在故障转移切换时，检查 `extract_session_id()` 返回的 session_id 是否已绑定到某 provider。如果绑定且该 provider 熔断器**半开（HalfOpen）**而非 Open，则继续用它（容忍一次错误），避免无故换后端
- `proxy/provider_router.rs`：新增 `HashMap<session_id, provider_id>` 绑定表（带 TTL 5 分钟清理）
- 触发条件：仅当 `auto_failover_enabled` 且 `session_id` 非 Generated 时生效

**估计工作量**：2-3 天
**涉及文件**：
- `proxy/forwarder.rs`（~6100 行，改 `forward_to_provider` 的 provider 循环逻辑）
- `proxy/provider_router.rs`（新增 `session_binding: Arc<RwLock<HashMap<String, String>>>`）

### F2 — 托盘 Quick Switcher

**目标**：不打开主窗口，从托盘弹出模糊搜索框一键切换供应商/Profile。

**改动点**：
- `src/tray-panel/TrayPanel.tsx`：新增第三个 Tab `"switch"`（现有 `config | usage`），内嵌一个 `CommandInput` + 模糊搜索列表
- 数据源：`tray-panel/api.ts` 的 `trayPanelApi`（已有 provider 列表和切换 invoke）
- 交互：聚焦输入框 → 上下键选择 → Enter 切换 → Esc 关闭 → 切换后 emit `CHANGED_EVENT` 刷新主窗口

**估计工作量**：2 天
**涉及文件**：
- `src/tray-panel/TrayPanel.tsx`（加 tab + 搜索组件）
- `src/tray-panel/api.ts`（暴露 `switchProvider(appType, providerId)`）

### F3 — 路由组（Routing Groups）

**对标 Magpie**：把线性 failover queue 升级为命名路由组，组内可嵌套组，支持多种策略。

**改动点**：

**数据库**（`database/schema.rs`）：
```sql
CREATE TABLE IF NOT EXISTS routing_groups (
    id TEXT PRIMARY KEY,
    app_type TEXT NOT NULL,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL DEFAULT 'order',  -- order | smart | rotate | usage | pace
    members TEXT NOT NULL DEFAULT '[]',      -- JSON: [{type:"provider", id:"..."}, {type:"group", id:"..."}]
    enabled BOOLEAN NOT NULL DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
);
```

**Rust 后端**：
- `proxy/routing_group.rs`（新文件）：解析 members JSON → 展开为扁平 Provider 序列 → 按策略排序
  - `order`：顺序尝试（=现有 failover）
  - `smart`：按剩余额度百分比 ÷ 剩余重置时间排序（调用现有 `usage_cache`）
  - `rotate`：按请求计数器轮转
  - `usage`：按当日 token 用量升序
- `proxy/provider_router.rs`：`select_providers_with_current()` 改为：如果当前 provider 属于某个启用的路由组 → 用组策略展开；否则走旧逻辑（向后兼容）
- `commands/routing_group.rs`（新文件）：CRUD 命令

**前端**：
- `src/components/proxy/RoutingGroupsPanel.tsx`（新文件）：替代/增强现有 `AutoFailoverConfigPanel.tsx`
- `src/lib/api/routingGroup.ts`（新文件）：invoke 封装

**估计工作量**：1-1.5 周
**涉及文件**：~8 个新文件 + 4 个修改

### F4 — 从 Magpie 导入配置

**目标**：读 `~/.magpie/config.json`（或 Magpie 实际存储路径），导入 providers 和模型映射。

**改动点**：
- `commands/import_export.rs`：新增 `import_from_magpie` 命令
- 解析 Magpie 的 provider JSON 结构 → 映射到 cc-switch 的 `Provider` 模型
- 处理 Magpie 特有的 subscription/account 类型（跳过或提示手动配置）

**估计工作量**：1-2 天

---

## Phase 2：中期

### F5 — 意图路由（Intent Routing）

**对标 Magpie**：用小模型判定每个 turn 应该去强模型还是便宜模型。

**改动点**：
- `proxy/intent_router.rs`（新文件）：
  - 在 `forwarder.rs` 的请求入口，提取最后一条 user message
  - 用配置的"判定模型"（如 Haiku / GLM-4-Flash）发一个短 prompt：`"Classify: [simple_coding | complex_coding | question | test]"`
  - 根据分类结果 → 在路由组中选不同的 provider 子集
- 配置 UI：设置页新增"意图路由"区
- 仅在路由模式下生效（直连模式不走网关）

**技术难点**：
- 判定调用本身也有成本/延迟（~200ms）。可以缓存（按 system prompt hash）减少调用
- 判定模型本身挂了 → fallback 到 order 策略

**估计工作量**：1.5 周
**依赖**：F3 路由组（意图路由需要在组内选择子集）

### F6 — CLI 二进制

**目标**：`ccswitch use <profile>` / `ccswitch claude <provider>` / `ccswitch quota`。

**方案**：利用已有 Axum proxy server 暴露的 REST API，CLI 作为轻量客户端（不需要重 Rust 后端编译）。

**改动点**：
- `proxy/server.rs`：新增管理 API 路由（带本地 auth token）
  ```
  POST /api/switch { app_type, provider_id }
  GET  /api/current
  GET  /api/quota
  POST /api/profile/apply { profile_id }
  ```
- `cli/` 新 crate（或单文件 `src/bin/cli.rs`）：
  ```rust
  // 读 ~/.cc-switch/cli_token 获取 auth → 调用本地 API
  #[derive(Parser)]
  enum Command {
      Use { profile: String },
      Claude { provider: String },
      Quota,
  }
  ```
- Tauri 启动时生成 token 文件，权限 `600`

**估计工作量**：1 周

### F7 — 配额预热定时器

**对标 Magpie**：Claude/ChatGPT 的 5h 窗口重置后自动发一个 ping 请求，避免第一次用等冷启动。

**改动点**：
- `services/quota_warmup.rs`（新文件）：tokio 定时任务
- 读取现有 `usage_cache` 中的重置时间 → 计算下一次重置时刻 → 提前 1 分钟发一个 1-token 请求
- 配置 UI：设置页开关 + 时间偏移

**估计工作量**：3-4 天

### F8 — 多账号轮换

**目标**：同一供应商下多个 API key，按请求计数轮转（或按 key 余额轮转）。

**改动点**：
- `database/schema.rs`：providers 表增加 `api_keys TEXT`（JSON 数组）
- `proxy/forwarder.rs`：选择 provider 后，如果有多 key → 按 rotate 策略选 key
- UI：供应商编辑弹窗支持添加多个 key

**估计工作量**：1 周

---

## Phase 3：长期

### F9 — 订阅桥接（Claude 订阅 → Codex 用）

**对标 Magpie 最强亮点**：让 Codex 走 Claude 的官方订阅。

**技术路线**：
- 在本地起一个 Anthropic Messages 协议兼容端点
- 收到请求后 → 转发到已登录的 `claude` CLI 进程（通过 `claude --print` 或内部 MCP bridge）
- 响应流回 Codex

**改动点**：
- `proxy/subscription_bridge/` 新模块
- Claude CLI 进程管理（spawn/reuse/health check）
- Codex 请求 → Anthropic Messages 转换（复用 `providers/transform_codex_anthropic.rs` 已有逻辑，反向）

**估计工作量**：3-4 周
**风险**：Claude CLI 可能封杀非标准调用；需要跟进 Anthropic 政策

### F10 — 插件网关中间件

**对标 Magpie**：用户可写 JS hook 改写请求/响应。

**改动点**：
- `proxy/plugin_runtime.rs`（新文件）：用 `rquickjs`（轻量 QuickJS 绑定）运行 JS
- 暴露 `onRequest(body, ctx)` / `onResponse(body, ctx)` / `onEvent(event, ctx)`
- Plugin 目录：`~/.cc-switch/plugins/*.js`
- 超时/异常 → 请求原样通过

**估计工作量**：2-3 周

### F11 — 远程 Web UI

**目标**：手机浏览器访问 CC Switch 托盘面板的核心功能。

**改动点**：
- 复用 Axum proxy server 的管理 API（F6 已建）
- 加一个静态 HTML/JS 页面（`/ui`），提供：供应商切换、额度查看、Profile 切换
- 远程访问需配对 token（局域网内扫码配对）

**估计工作量**：2 周（依赖 F6）

---

## 📋 执行优先级建议

| 排名 | Feature | 理由 |
|---|---|---|
| 1 | **F1 Sticky Session** | 改动最小（~100 行 Rust），收益最直接（省钱），也是用户最容易感知的改进 |
| 2 | **F3 路由组** | 是 F5/F8 的基础，且现有 failover queue 升级路径清晰 |
| 3 | **F2 Quick Switcher** | 前端改动独立，2 天出活，用户感知强 |
| 4 | **F4 Magpie 导入** | 1-2 天，战略意义大于工程量 |
| 5 | **F6 CLI** | 打开新使用场景，是后续 F11 的前提 |
| 6 | **F5 意图路由** | 高级功能，需要 F3 完成 |
| 7 | **F7 配额预热** | 实现简单，效果好 |
| 8 | **F8 多账号轮换** | 需求大但改动面广 |
| 9 | **F9 订阅桥接** | Magpie 的王牌功能，风险高但回报大 |
| 10 | **F10 插件** | 生态建设，长期价值 |
| 11 | **F11 远程 UI** | 锦上添花 |

---

需要我进一步做什么？
- 选一个 feature 直接开始写代码实现
- 对某个 feature 做更详细的技术设计（含 API schema、数据流图、边界 case）
- 研究 Magpie 对应功能的具体实现（读它的 Go 源码）