use std::fs;
use tauri::Manager;

fn config_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Konfigurationsverzeichnis nicht ermittelbar: {e}"))?;
    Ok(dir.join("storage.json"))
}

fn read_configured_data_dir(app: &tauri::AppHandle) -> Option<String> {
    let path = config_file_path(app).ok()?;
    let content = fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("data_dir")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn data_dir_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    if let Some(dir) = read_configured_data_dir(app) {
        if !dir.trim().is_empty() {
            return Ok(std::path::PathBuf::from(dir));
        }
    }
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Datenverzeichnis nicht ermittelbar: {e}"))
}

fn data_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(data_dir_path(app)?.join("user-data.json"))
}

#[tauri::command]
fn load_user_data(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = data_file_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => {
            let backup = path.with_extension("json.bak");
            match fs::read_to_string(&backup) {
                Ok(content) => Ok(Some(content)),
                Err(_) => Err(format!("Benutzerdaten nicht lesbar: {e}")),
            }
        }
    }
}

#[tauri::command]
fn save_user_data(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let path = data_file_path(&app)?;
    let dir = path
        .parent()
        .ok_or_else(|| "Ungültiges Datenverzeichnis".to_string())?;
    fs::create_dir_all(dir).map_err(|e| format!("Datenverzeichnis nicht anlegbar: {e}"))?;
    if path.exists() {
        let backup = path.with_extension("json.bak");
        fs::copy(&path, &backup).map_err(|e| format!("Sicherung fehlgeschlagen: {e}"))?;
    }
    fs::write(&path, json).map_err(|e| format!("Speichern fehlgeschlagen: {e}"))?;
    Ok(())
}

#[tauri::command]
fn data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = data_dir_path(&app)?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn set_data_dir(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let new_dir = std::path::PathBuf::from(path.trim());
    if new_dir.as_os_str().is_empty() {
        return Err("Kein Verzeichnis angegeben".to_string());
    }
    let canonical = new_dir
        .canonicalize()
        .map_err(|e| format!("Verzeichnis nicht zugreifbar: {e}"))?;
    if !canonical.is_dir() {
        return Err("Pfad ist kein Verzeichnis".to_string());
    }

    let old_path = data_file_path(&app)?;
    let new_path = canonical.join("user-data.json");
    if !new_path.exists() && old_path.exists() {
        fs::copy(&old_path, &new_path)
            .map_err(|e| format!("Benutzerdaten nicht übertragbar: {e}"))?;
        let old_backup = old_path.with_extension("json.bak");
        if old_backup.exists() {
            let _ = fs::copy(&old_backup, new_path.with_extension("json.bak"));
        }
    }

    let config_path = config_file_path(&app)?;
    let config_dir = config_path
        .parent()
        .ok_or_else(|| "Ungültiges Konfigurationsverzeichnis".to_string())?;
    fs::create_dir_all(config_dir)
        .map_err(|e| format!("Konfigurationsverzeichnis nicht anlegbar: {e}"))?;
    let config = serde_json::json!({ "data_dir": canonical.to_string_lossy() });
    fs::write(
        &config_path,
        serde_json::to_string_pretty(&config).map_err(|e| format!("Konfiguration nicht serialisierbar: {e}"))?,
    )
    .map_err(|e| format!("Konfiguration nicht speicherbar: {e}"))?;

    Ok(canonical.to_string_lossy().into_owned())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let target = std::path::PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("Kein Dateipfad angegeben".to_string());
    }
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Verzeichnis nicht anlegbar: {e}"))?;
    }
    fs::write(&target, content).map_err(|e| format!("Datei nicht schreibbar: {e}"))?;
    Ok(())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let target = std::path::PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err("Kein Dateipfad angegeben".to_string());
    }
    fs::read_to_string(&target).map_err(|e| format!("Datei nicht lesbar: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            load_user_data,
            save_user_data,
            data_dir,
            set_data_dir,
            write_text_file,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
