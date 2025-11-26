#[cfg(target_os = "windows")]
pub fn enable_autostart(app_name: &str, app_path: &str) -> Result<(), String> {
    use std::process::Command;
    
    let key = format!("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run");
    let output = Command::new("reg")
        .args(&["add", &key, "/v", app_name, "/t", "REG_SZ", "/d", app_path, "/f"])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(())
    } else {
        Err("Failed to add registry key".to_string())
    }
}

#[cfg(target_os = "macos")]
pub fn enable_autostart(app_name: &str, app_path: &str) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;
    
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let plist_path = PathBuf::from(home)
        .join("Library/LaunchAgents")
        .join(format!("com.{}.plist", app_name));
    
    let plist_content = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.{}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>"#,
        app_name, app_path
    );
    
    fs::write(plist_path, plist_content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_autostart(enabled: bool, app_name: String, app_path: String) -> Result<(), String> {
    if enabled {
        enable_autostart(&app_name, &app_path)
    } else {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
            let _ = Command::new("reg")
                .args(&["delete", key, "/v", &app_name, "/f"])
                .output();
        }
        
        #[cfg(target_os = "macos")]
        {
            use std::fs;
            use std::path::PathBuf;
            let home = std::env::var("HOME").unwrap_or_default();
            let plist_path = PathBuf::from(home)
                .join("Library/LaunchAgents")
                .join(format!("com.{}.plist", app_name));
            let _ = fs::remove_file(plist_path);
        }
        
        Ok(())
    }
}

pub fn is_autostart_enabled(app_name: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let key = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
        let output = Command::new("reg")
            .args(&["query", key, "/v", &app_name])
            .output()
            .map_err(|e| e.to_string())?;
        
        Ok(output.status.success())
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::path::PathBuf;
        let home = std::env::var("HOME").unwrap_or_default();
        let plist_path = PathBuf::from(home)
            .join("Library/LaunchAgents")
            .join(format!("com.{}.plist", app_name));
        Ok(plist_path.exists())
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Ok(false)
}
