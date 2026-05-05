//! src-tauri/src/lib.rs — Miwa Tauri backend
//!
//! Commands exposed to the frontend:
//! - set_click_through(enabled: bool)  — mouse passes through overlay
//! - set_always_on_top(enabled: bool)  — toggle always-on-top
//! - get_window_position()             — returns (x, y) in logical pixels
//! Note: opacity is applied via CSS on the overlay root element.

use tauri::{command, WebviewWindow};

#[command]
async fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

#[command]
async fn set_always_on_top(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())
}

#[command]
async fn get_window_position(window: WebviewWindow) -> Result<(i32, i32), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok((pos.x, pos.y))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            set_always_on_top,
            get_window_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}