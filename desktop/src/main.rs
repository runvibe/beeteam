#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod server;

use std::{process::Child, sync::Mutex};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;

struct DesktopState {
    child: Mutex<Option<Child>>,
    keep_in_tray: std::sync::atomic::AtomicBool,
}

fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    use std::sync::atomic::{AtomicBool, Ordering};
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--hidden"])
                .build(),
        )
        .setup(|app| {
            let prefs = app.path().app_config_dir()?.join("exit-on-close");
            let keep = !prefs.exists();
            app.manage(DesktopState {
                child: Mutex::new(None),
                keep_in_tray: AtomicBool::new(keep),
            });
            let open = MenuItem::with_id(app, "open", "Open Bee Team", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Bee Team")
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show(app),
                    "quit" => app.exit(0),
                    _ => (),
                })
                .build(app)?;
            let tray_pref = CheckMenuItem::with_id(
                app,
                "background",
                "Keep in tray when window closes",
                true,
                keep,
                None::<&str>,
            )?;
            let login = CheckMenuItem::with_id(
                app,
                "login",
                "Start hidden at login",
                true,
                app.autolaunch().is_enabled()?,
                None::<&str>,
            )?;
            let settings =
                tauri::menu::Submenu::with_items(app, "Desktop", true, &[&tray_pref, &login])?;
            app.set_menu(Menu::with_items(app, &[&settings])?)?;
            app.on_menu_event(move |app, event| match event.id.as_ref() {
                "background" => {
                    let next = tray_pref.is_checked().unwrap_or(true);
                    let saved = if next {
                        std::fs::remove_file(&prefs)
                    } else {
                        std::fs::create_dir_all(prefs.parent().unwrap())
                            .and_then(|_| std::fs::write(&prefs, []))
                    };
                    if saved.is_ok() {
                        app.state::<DesktopState>()
                            .keep_in_tray
                            .store(next, Ordering::SeqCst);
                    } else {
                        let _ = tray_pref.set_checked(!next);
                    }
                }
                "login" => {
                    let manager = app.autolaunch();
                    let result = if login.is_checked().unwrap_or(false) {
                        manager.enable()
                    } else {
                        manager.disable()
                    };
                    if result.is_err() {
                        let _ = login.set_checked(manager.is_enabled().unwrap_or(false));
                    }
                }
                _ => (),
            });
            let hidden = std::env::args().any(|a| a == "--hidden");
            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Bee Team Desktop")
                    .inner_size(1160., 760.)
                    .visible(!hidden)
                    .build()?;
            let handle = app.handle().clone();
            std::thread::spawn(move || match server::connect() {
                Ok(connection) => {
                    *handle.state::<DesktopState>().child.lock().unwrap() = connection.child;
                    if let Ok(url) = connection.url.parse() {
                        let _ = window.navigate(url);
                    }
                }
                Err(error) => {
                    let message = serde_json::to_string(&error).unwrap();
                    let _ = window.eval(format!(
                        "document.getElementById('status').textContent={message}"
                    ));
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window
                    .state::<DesktopState>()
                    .keep_in_tray
                    .load(Ordering::SeqCst)
                {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("could not initialize Bee Team Desktop");
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Some(mut child) = app.state::<DesktopState>().child.lock().unwrap().take() {
                drop(child.stdin.take());
                let _ = child.wait();
            }
        }
    });
}
