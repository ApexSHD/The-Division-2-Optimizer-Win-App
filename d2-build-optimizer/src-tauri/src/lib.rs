use std::fs;
use tauri::Manager;

fn data_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Datenverzeichnis nicht ermittelbar: {e}"))?;
    Ok(dir.join("user-data.json"))
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
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Datenverzeichnis nicht ermittelbar: {e}"))?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![load_user_data, save_user_data, data_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
