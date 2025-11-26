use tauri::{Manager, State};
use tauri::tray::TrayIconBuilder;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri_plugin_store::StoreExt;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Settings {
    api_url: String,
    api_key: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:9759".to_string(),
            api_key: String::new(),
        }
    }
}

struct AppState {
    settings: Arc<Mutex<Settings>>,
    store_path: std::path::PathBuf,
}

const STORE_FILENAME: &str = "settings.json";

#[tauri::command]
async fn save_settings(api_url: String, api_key: String, state: State<'_, AppState>, app: tauri::AppHandle) -> Result<(), String> {
    let settings = Settings { api_url, api_key };
    
    // Save to memory
    let mut app_settings = state.settings.lock().unwrap();
    *app_settings = settings.clone();
    
    // Save to persistent storage
    let store = app.store(STORE_FILENAME).map_err(|e| e.to_string())?;
    store.set("api_url", serde_json::to_value(&settings.api_url).unwrap());
    store.set("api_key", serde_json::to_value(&settings.api_key).unwrap());
    store.save().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let settings = state.settings.lock().unwrap();
    Ok(settings.clone())
}

#[tauri::command]
async fn send_ping(state: State<'_, AppState>) -> Result<String, String> {
    let settings = state.settings.lock().unwrap().clone();
    
    if settings.api_key.is_empty() {
        return Err("API key not configured".to_string());
    }
    
    let client = reqwest::Client::new();
    let url = format!("{}/api/v1/ping", settings.api_url);
    
    match client
        .post(&url)
        .header("X-API-Key", &settings.api_key)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok("Ping successful".to_string())
            } else {
                Err(format!("Ping failed: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

#[tauri::command]
async fn test_connection(api_url: String, api_key: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/v1/ping", api_url);
    
    match client
        .post(&url)
        .header("X-API-Key", &api_key)
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok("Connection successful!".to_string())
            } else {
                Err(format!("Failed: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Error: {}", e)),
    }
}

#[tauri::command]
async fn set_launch_on_startup(enabled: bool) -> Result<(), String> {
    tauri_plugin_autostart::set_autostart(
        enabled,
        "StatusIndicator".to_string(),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.to_str().map(String::from))
            .unwrap_or_default()
    )
}

#[tauri::command]
async fn is_launch_on_startup() -> Result<bool, String> {
    tauri_plugin_autostart::is_autostart_enabled("StatusIndicator".to_string())
}

async fn ping_loop(state: Arc<Mutex<Settings>>) {
    loop {
        tokio::time::sleep(Duration::from_secs(900)).await; // 15 minutes
        
        let settings = state.lock().unwrap().clone();
        
        if !settings.api_key.is_empty() {
            let client = reqwest::Client::new();
            let url = format!("{}/api/v1/ping", settings.api_url);
            
            let _ = client
                .post(&url)
                .header("X-API-Key", &settings.api_key)
                .send()
                .await;
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Load settings from persistent storage
            let store = app.store(STORE_FILENAME)?;
            
            let api_url = store.get("api_url")
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| "http://localhost:9759".to_string());
            
            let api_key = store.get("api_key")
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_default();
            
            let initial_settings = Settings { api_url, api_key };
            
            let app_state = AppState {
                settings: Arc::new(Mutex::new(initial_settings)),
                store_path: app.path().app_data_dir()?,
            };
            app.manage(app_state);
            
            // Build tray menu
            let show_settings = MenuItemBuilder::with_id("show_settings", "Settings").build(app)?;
            let ping_now = MenuItemBuilder::with_id("ping_now", "Ping Now").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            
            let menu = MenuBuilder::new(app)
                .items(&[&show_settings, &ping_now, &quit])
                .build()?;
            
            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Status Indicator")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show_settings" => {
                            if let Some(window) = app.get_webview_window("settings") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "ping_now" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                let settings = state.settings.clone();
                                tauri::async_runtime::spawn(async move {
                                    let settings_data = settings.lock().unwrap().clone();
                                    
                                    if !settings_data.api_key.is_empty() {
                                        let client = reqwest::Client::new();
                                        let url = format!("{}/api/v1/ping", settings_data.api_url);
                                        
                                        let _ = client
                                            .post(&url)
                                            .header("X-API-Key", &settings_data.api_key)
                                            .send()
                                            .await;
                                    }
                                });
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            // Start background ping loop
            let settings_clone = app.state::<AppState>().settings.clone();
            tauri::async_runtime::spawn(async move {
                ping_loop(settings_clone).await;
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_settings, 
            get_settings, 
            send_ping, 
            test_connection,
            set_launch_on_startup,
            is_launch_on_startup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
