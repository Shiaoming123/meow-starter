use std::io;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

/// 主窗口 label，需与 tauri.conf.json 中的窗口 label 保持一致。
pub const MAIN_WINDOW_LABEL: &str = "main";

/// 托盘菜单点击后向前端广播的事件名。
pub const CHECK_UPDATE_EVENT: &str = "tray://check-update";

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let toggle = MenuItem::with_id(app, "toggle", "显示 / 隐藏窗口", true, None::<&str>)?;
    let check_update = MenuItem::with_id(app, "check_update", "检查更新…", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle, &check_update, &separator, &quit])?;

    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        io::Error::new(io::ErrorKind::NotFound, "default window icon is missing")
    })?;

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("Tauri Vue 模板")
        .menu(&menu)
        // 左键交给 on_tray_icon_event 处理，右键才弹菜单
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_window(app),
            "check_update" => {
                let _ = app.emit(CHECK_UPDATE_EVENT, ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon<R>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
