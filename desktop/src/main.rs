mod env;
mod server;

use beeteam::libs::telemetry::TelemetryGuard;
use std::{sync::Mutex, time::Duration};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[derive(Default)]
struct ServerSlot(Mutex<Option<server::RunningServer>>);

struct TelemetrySlot(#[allow(dead_code)] TelemetryGuard);

fn boot() -> anyhow::Result<(server::RunningServer, TelemetryGuard)> {
    let home = std::env::home_dir().ok_or_else(|| anyhow::anyhow!("Cannot resolve user home"))?;
    env::load_desktop_env(&home.join(".beeteam").join("desktop.env"))?;
    let telemetry =
        beeteam::libs::telemetry::init_tracing(beeteam::config::otel_enabled_from_env())?;
    let running = tauri::async_runtime::block_on(server::start())?;
    Ok((running, telemetry))
}

/// Debug builds can open a live frontend dev server instead of starting the
/// embedded server; the dev server proxies to an already running API.
fn dev_url() -> Option<String> {
    if cfg!(debug_assertions) {
        std::env::var("BEE_DESKTOP_DEV_URL")
            .ok()
            .filter(|v| !v.is_empty())
    } else {
        None
    }
}

fn open_main_window(app: &tauri::App, url: tauri::Url) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Bee Team")
        .inner_size(1280.0, 800.0)
        .build()?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(ServerSlot::default())
        .setup(|app| {
            if let Some(url) = dev_url() {
                open_main_window(app, url.parse()?)?;
                return Ok(());
            }
            match boot() {
                Ok((running, telemetry)) => {
                    let url = running.url.parse()?;
                    app.state::<ServerSlot>().0.lock().unwrap().replace(running);
                    app.manage(TelemetrySlot(telemetry));
                    open_main_window(app, url)?;
                }
                Err(error) => {
                    let handle = app.handle().clone();
                    app.dialog()
                        .message(format!("{error:#}"))
                        .title("Bee Team could not start")
                        .kind(MessageDialogKind::Error)
                        .show(move |_| handle.exit(1));
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Bee Team desktop")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                let running = app.state::<ServerSlot>().0.lock().unwrap().take();
                if let Some(running) = running {
                    let _ = running.shutdown.send(());
                    // The timer must be created inside the Tokio runtime.
                    tauri::async_runtime::block_on(async move {
                        if tokio::time::timeout(Duration::from_secs(5), running.task)
                            .await
                            .is_err()
                        {
                            eprintln!("Bee Team server did not stop within 5 seconds");
                        }
                    });
                }
            }
        });
}
