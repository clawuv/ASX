//! 系统通知：主窗口隐藏时，用 OS 通知兜底后台发生的关键事件（故障转移切换）。
//!
//! 应用内 toast 只在窗口可见时能看到；静默启动或最小化到托盘的场景里，
//! 代理故障转移已经换了路由而用户毫无感知。窗口可见时跳过，避免和 toast
//! 重复打扰。文案语言跟随托盘（`tray_language`），与用户在别处看到的一致。

use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::app_config::AppType;

/// 主窗口隐藏（或不存在，如轻量模式）时才发通知。
fn main_window_hidden(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .map(|visible| !visible)
        .unwrap_or(true)
}

/// 故障转移切换成功后的兜底通知；窗口可见时不发（前端 UI 已能反馈）。
pub fn notify_failover_switch(app: &AppHandle, app_type: &AppType, provider_name: &str) {
    if !main_window_hidden(app) {
        return;
    }

    let language = crate::tray::tray_language();
    let app_name = crate::tray::app_display_name(app_type);
    let name = crate::tray::truncate_chars(provider_name, 40);
    let (title, body) = failover_text(&language, app_name, &name);

    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        log::warn!("[Notify] 发送故障转移系统通知失败: {e}");
    }
}

fn failover_text(language: &str, app_name: &str, name: &str) -> (String, String) {
    match language {
        "zh-TW" => (
            "已自動切換供應商".into(),
            format!("{app_name} 已容錯轉移到「{name}」"),
        ),
        "en" => (
            "Provider switched automatically".into(),
            format!("{app_name} failed over to \"{name}\""),
        ),
        "ja" => (
            "プロバイダーを自動切り替えしました".into(),
            format!("{app_name} は「{name}」にフェイルオーバーしました"),
        ),
        "tr" => (
            "Sağlayıcı otomatik değiştirildi".into(),
            format!("{app_name} → \"{name}\" (yedek devri)"),
        ),
        // zh 及未覆盖的语言回退简体中文，与托盘文案策略一致
        _ => (
            "已自动切换供应商".into(),
            format!("{app_name} 已故障转移到「{name}」"),
        ),
    }
}
