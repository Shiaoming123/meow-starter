#[cfg(desktop)]
use tauri::{Manager, WindowEvent};

#[cfg(feature = "agent")]
mod agent;
mod db;
#[cfg(desktop)]
mod tray;

/// 前端 -> Rust 的示例命令，演示 IPC 的类型传递。
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 自动更新装完后需要 process 插件来重启应用
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        // —— 核心能力：始终启用 ——
        // 轻量键值持久化，适合存窗口尺寸之类的 UI 偏好
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db::DB_URL, db::migrations())
                .build(),
        );

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // —— 可选模块：按 Cargo feature 装配（与前端 modules.config.ts 的 P1 模块对应） ——

    #[cfg(feature = "shortcut")]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    #[cfg(feature = "clipboard")]
    {
        builder = builder.plugin(tauri_plugin_clipboard_manager::init());
    }

    #[cfg(feature = "notification")]
    {
        builder = builder.plugin(tauri_plugin_notification::init());
    }

    #[cfg(feature = "autostart")]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    #[cfg(feature = "agent")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            greet,
            agent::set_api_key,
            agent::has_api_key,
            agent::delete_api_key,
            agent::proxy_json,
            agent::proxy_stream
        ]);
    }

    #[cfg(not(feature = "agent"))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![greet]);
    }

    #[cfg(desktop)]
    {
        builder = builder
            // 二次启动时聚焦已有窗口，而不是开第二个实例
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                show_main_window(app);
            }))
            .setup(|app| {
                tray::create_tray(app.handle())?;

                // 托盘常驻应用：点关闭按钮时隐藏窗口而不是退出进程，
                // 真正的退出走托盘菜单里的「退出」。
                if let Some(window) = app.get_webview_window(tray::MAIN_WINDOW_LABEL) {
                    // Tauri 2 的 on_window_event 闭包只接收 event，
                    // 窗口句柄需要提前 clone 进闭包。
                    let event_window = window.clone();
                    window.on_window_event(move |event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            let _ = event_window.hide();
                            api.prevent_close();
                        }
                    });
                }

                Ok(())
            });
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window(tray::MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
