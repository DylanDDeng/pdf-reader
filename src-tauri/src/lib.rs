use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfFile {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub files: Vec<PdfFile>,
    pub total_count: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
}

// Store active watchers
static WATCHERS: Mutex<Option<HashMap<String, RecommendedWatcher>>> = Mutex::new(None);

#[tauri::command]
fn scan_directory_for_pdfs(
    dir_path: String,
    recursive: bool,
    max_depth: usize,
) -> Result<ScanResult, String> {
    let path = Path::new(&dir_path);

    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path));
    }

    let mut files = Vec::new();
    let mut errors = Vec::new();
    let mut error_count = 0;

    let walker = if recursive {
        WalkDir::new(path).max_depth(max_depth)
    } else {
        WalkDir::new(path).max_depth(1)
    };

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();

        if entry_path.is_file() {
            if let Some(extension) = entry_path.extension() {
                if extension.to_string_lossy().to_lowercase() == "pdf" {
                    match entry_path.metadata() {
                        Ok(metadata) => {
                            files.push(PdfFile {
                                name: entry_path
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default(),
                                path: entry_path.to_string_lossy().to_string(),
                                size: metadata.len(),
                            });
                        }
                        Err(e) => {
                            error_count += 1;
                            errors.push(format!(
                                "Failed to read metadata for {}: {}",
                                entry_path.display(),
                                e
                            ));
                        }
                    }
                }
            }
        }
    }

    // Sort files by name
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(ScanResult {
        total_count: files.len(),
        error_count,
        errors,
        files,
    })
}

#[tauri::command]
async fn start_watch_folder(
    app: AppHandle,
    folder_path: String,
    recursive: bool,
) -> Result<String, String> {
    let path = Path::new(&folder_path);

    if !path.exists() {
        return Err(format!("Directory does not exist: {}", folder_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }

    // Generate a unique ID for this watcher
    let watch_id = uuid::Uuid::new_v4().to_string();
    let watch_id_clone = watch_id.clone();
    let folder_path_clone = folder_path.clone();

    let app_handle = app.clone();
    let mode = if recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    // Check if this is a file creation event
                    if matches!(event.kind, EventKind::Create(_)) {
                        for path in &event.paths {
                            if path.extension()
                                .map(|ext| ext.to_string_lossy().to_lowercase() == "pdf")
                                .unwrap_or(false)
                            {
                                let _ = app_handle.emit(
                                    "folder-changed",
                                    serde_json::json!({
                                        "watchId": watch_id_clone,
                                        "folderPath": folder_path_clone,
                                        "eventType": "created",
                                        "filePath": path.to_string_lossy().to_string(),
                                    }),
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {:?}", e);
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(path, mode)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    // Store the watcher
    let mut watchers = WATCHERS.lock().unwrap();
    if watchers.is_none() {
        *watchers = Some(HashMap::new());
    }
    watchers
        .as_mut()
        .unwrap()
        .insert(watch_id.clone(), watcher);

    Ok(watch_id)
}

#[tauri::command]
fn stop_watch_folder(watch_id: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().unwrap();

    if let Some(watchers_map) = watchers.as_mut() {
        if watchers_map.remove(&watch_id).is_some() {
            return Ok(());
        }
    }

    Err(format!("Watcher with ID {} not found", watch_id))
}

#[tauri::command]
fn get_file_metadata(file_path: String) -> Result<FileMetadata, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let metadata = path
        .metadata()
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileMetadata {
        name,
        path: file_path,
        size: metadata.len(),
        modified: metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64),
    })
}

#[tauri::command]
fn verify_files_exist(file_paths: Vec<String>) -> Vec<(String, bool)> {
    file_paths
        .iter()
        .map(|path| {
            let exists = Path::new(path).exists();
            (path.clone(), exists)
        })
        .collect()
}

#[tauri::command]
fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    let path = Path::new(&old_path);

    // Verify file exists
    if !path.exists() {
        return Err(format!("File does not exist: {}", old_path));
    }

    if !path.is_file() {
        return Err(format!("Path is not a file: {}", old_path));
    }

    // Get parent directory and construct new path
    let parent = path
        .parent()
        .ok_or_else(|| "Could not determine parent directory".to_string())?;

    // Get the file extension (preserve it)
    let extension = path
        .extension()
        .map(|ext| ext.to_string_lossy().to_string());

    // Construct new filename with extension
    let new_filename = if let Some(ext) = extension {
        format!("{}.{}", new_name, ext)
    } else {
        new_name.clone()
    };

    let new_path = parent.join(&new_filename);

    // Check if new path already exists
    if new_path.exists() {
        return Err(format!(
            "A file named '{}' already exists in this location",
            new_filename
        ));
    }

    // Perform the rename
    std::fs::rename(&path, &new_path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: Option<i64>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_directory_for_pdfs,
            start_watch_folder,
            stop_watch_folder,
            get_file_metadata,
            verify_files_exist,
            rename_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
