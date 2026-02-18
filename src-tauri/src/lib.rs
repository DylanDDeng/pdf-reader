use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use quick_xml::de::from_str;
use regex::Regex;
use reqwest::Client;
use sanitize_filename::sanitize;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use url::Url;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArxivPaperMetadata {
    pub arxiv_id: String,
    pub version: u32,
    pub title: String,
    pub authors: Vec<String>,
    pub summary: String,
    pub published: String,
    pub updated: String,
    pub abs_url: String,
    pub pdf_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArxivImportResult {
    pub status: String,
    pub reason: Option<String>,
    pub pdf_path: Option<String>,
    pub pdf_size: Option<u64>,
    pub metadata_path: Option<String>,
    pub paper: Option<ArxivPaperMetadata>,
}

#[derive(Debug, Deserialize)]
struct ArxivApiFeed {
    #[serde(rename = "entry", default)]
    entry: Vec<ArxivApiEntry>,
}

#[derive(Debug, Deserialize)]
struct ArxivApiEntry {
    id: Option<String>,
    title: Option<String>,
    summary: Option<String>,
    published: Option<String>,
    updated: Option<String>,
    #[serde(rename = "author", default)]
    author: Vec<ArxivApiAuthor>,
    #[serde(rename = "link", default)]
    link: Vec<ArxivApiLink>,
}

#[derive(Debug, Deserialize)]
struct ArxivApiAuthor {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ArxivApiLink {
    #[serde(rename = "@href")]
    href: Option<String>,
}

fn parse_plain_arxiv_id(value: &str) -> Option<(String, Option<u32>)> {
    let pattern = Regex::new(
        r"^(?P<base>(?:[A-Za-z\.\-]+/[0-9]{7}|[0-9]{4}\.[0-9]{4,5}))(?:v(?P<version>[0-9]+))?$",
    )
    .ok()?;
    let captures = pattern.captures(value.trim())?;
    let base = captures.name("base")?.as_str().to_lowercase();
    let version = captures
        .name("version")
        .and_then(|m| m.as_str().parse::<u32>().ok());
    Some((base, version))
}

fn parse_arxiv_input(value: &str) -> Option<(String, Option<u32>)> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(url) = Url::parse(trimmed) {
        let host = url.host_str()?.to_lowercase();
        if host != "arxiv.org" && host != "www.arxiv.org" {
            return None;
        }

        let path = url.path().trim_matches('/');
        if let Some(candidate) = path.strip_prefix("abs/") {
            return parse_plain_arxiv_id(candidate);
        }
        if let Some(candidate) = path.strip_prefix("pdf/") {
            let without_ext = candidate.strip_suffix(".pdf").unwrap_or(candidate);
            return parse_plain_arxiv_id(without_ext);
        }
        return None;
    }

    parse_plain_arxiv_id(trimmed)
}

fn compact_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn sanitize_title_for_filename(title: &str) -> String {
    let compact = compact_text(title);
    let underscored = compact.replace('/', " ").replace('\\', " ");
    let joined = underscored.split_whitespace().collect::<Vec<_>>().join("_");
    let truncated = joined.chars().take(96).collect::<String>();
    let cleaned = sanitize(&truncated);
    if cleaned.is_empty() {
        "paper".to_string()
    } else {
        cleaned
    }
}

fn unix_timestamp_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn skipped_result(reason: &str, paper: Option<ArxivPaperMetadata>) -> ArxivImportResult {
    ArxivImportResult {
        status: "skipped".to_string(),
        reason: Some(reason.to_string()),
        pdf_path: None,
        pdf_size: None,
        metadata_path: None,
        paper,
    }
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

#[tauri::command]
async fn import_arxiv_paper(
    input_url_or_id: String,
    target_dir: String,
    conflict_policy: String,
) -> Result<ArxivImportResult, String> {
    if conflict_policy != "skip" {
        return Ok(skipped_result("invalid_conflict_policy", None));
    }

    let (base_id, requested_version) = match parse_arxiv_input(&input_url_or_id) {
        Some(parsed) => parsed,
        None => return Ok(skipped_result("invalid_link", None)),
    };

    let target = Path::new(&target_dir);
    if target_dir.trim().is_empty() {
        return Ok(skipped_result("write_failed", None));
    }

    if !target.exists() {
        if let Err(error) = fs::create_dir_all(target) {
            eprintln!("Failed to create target directory: {:?}", error);
            return Ok(skipped_result("write_failed", None));
        }
    }

    if !target.is_dir() {
        return Ok(skipped_result("write_failed", None));
    }

    let client = match Client::builder()
        .timeout(Duration::from_secs(45))
        .user_agent("DocFlow/0.1 arXiv importer")
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            eprintln!("Failed to create reqwest client: {:?}", error);
            return Ok(skipped_result("network_error", None));
        }
    };

    let api_url = format!("https://export.arxiv.org/api/query?id_list={}", base_id);
    let api_response = match client.get(api_url).send().await {
        Ok(response) => response,
        Err(error) => {
            eprintln!("Failed to fetch arXiv metadata: {:?}", error);
            return Ok(skipped_result("network_error", None));
        }
    };

    if !api_response.status().is_success() {
        eprintln!(
            "arXiv metadata API returned non-success status: {}",
            api_response.status()
        );
        return Ok(skipped_result("network_error", None));
    }

    let feed_xml = match api_response.text().await {
        Ok(text) => text,
        Err(error) => {
            eprintln!("Failed to read arXiv metadata response: {:?}", error);
            return Ok(skipped_result("network_error", None));
        }
    };

    let feed = match from_str::<ArxivApiFeed>(&feed_xml) {
        Ok(parsed) => parsed,
        Err(error) => {
            eprintln!("Failed to parse arXiv metadata feed: {:?}", error);
            return Ok(skipped_result("paper_not_found", None));
        }
    };

    let entry = match feed.entry.into_iter().next() {
        Some(item) => item,
        None => return Ok(skipped_result("paper_not_found", None)),
    };

    let mut latest_version = 1u32;
    if let Some(entry_id) = entry.id.as_deref() {
        if let Some((entry_base_id, entry_version)) = parse_arxiv_input(entry_id) {
            if entry_base_id == base_id {
                if let Some(version) = entry_version {
                    latest_version = version.max(1);
                }
            }
        }
    }
    if latest_version == 1 {
        for link in &entry.link {
            if let Some(href) = link.href.as_deref() {
                if let Some((entry_base_id, entry_version)) = parse_arxiv_input(href) {
                    if entry_base_id == base_id {
                        if let Some(version) = entry_version {
                            latest_version = version.max(1);
                            break;
                        }
                    }
                }
            }
        }
    }

    let version = requested_version.unwrap_or(latest_version.max(1));
    let id_with_version = format!("{}v{}", base_id, version);
    let abs_url = format!("https://arxiv.org/abs/{}", id_with_version);
    let pdf_url = format!("https://arxiv.org/pdf/{}.pdf", id_with_version);

    let title = entry
        .title
        .as_deref()
        .map(compact_text)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("arXiv {}", id_with_version));
    let summary = entry
        .summary
        .as_deref()
        .map(compact_text)
        .unwrap_or_default();
    let published = entry.published.unwrap_or_default();
    let updated = entry.updated.unwrap_or_default();
    let authors = entry
        .author
        .into_iter()
        .filter_map(|author| author.name.map(|name| compact_text(&name)))
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>();

    let paper = ArxivPaperMetadata {
        arxiv_id: base_id.clone(),
        version,
        title: title.clone(),
        authors: authors.clone(),
        summary: summary.clone(),
        published: published.clone(),
        updated: updated.clone(),
        abs_url: abs_url.clone(),
        pdf_url: pdf_url.clone(),
    };

    let safe_id = id_with_version.replace('/', "_");
    let file_stem = format!("{}_{}", safe_id, sanitize_title_for_filename(&title));
    let pdf_path = target.join(format!("{}.pdf", file_stem));
    let metadata_path = target.join(format!("{}.metadata.json", file_stem));

    if conflict_policy == "skip" && pdf_path.exists() {
        return Ok(ArxivImportResult {
            status: "skipped".to_string(),
            reason: Some("file_exists".to_string()),
            pdf_path: Some(pdf_path.to_string_lossy().to_string()),
            pdf_size: None,
            metadata_path: if metadata_path.exists() {
                Some(metadata_path.to_string_lossy().to_string())
            } else {
                None
            },
            paper: Some(paper),
        });
    }

    let pdf_response = match client.get(&pdf_url).send().await {
        Ok(response) => response,
        Err(error) => {
            eprintln!("Failed to download arXiv PDF: {:?}", error);
            return Ok(skipped_result("network_error", Some(paper)));
        }
    };

    if !pdf_response.status().is_success() {
        let reason = if pdf_response.status().as_u16() == 404 {
            "paper_not_found"
        } else {
            "network_error"
        };
        return Ok(skipped_result(reason, Some(paper)));
    }

    let pdf_bytes = match pdf_response.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("Failed to read downloaded PDF bytes: {:?}", error);
            return Ok(skipped_result("network_error", Some(paper)));
        }
    };

    if let Err(error) = fs::write(&pdf_path, &pdf_bytes) {
        eprintln!("Failed to write downloaded PDF: {:?}", error);
        return Ok(skipped_result("write_failed", Some(paper)));
    }

    let metadata_json = serde_json::json!({
        "source": "arxiv",
        "arxiv_id": base_id,
        "version": version,
        "title": title,
        "authors": authors,
        "summary": summary,
        "published": published,
        "updated": updated,
        "abs_url": abs_url,
        "pdf_url": pdf_url,
        "downloaded_at": unix_timestamp_string(),
        "pdf_path": pdf_path.to_string_lossy().to_string()
    });

    if let Ok(metadata_text) = serde_json::to_string_pretty(&metadata_json) {
        if let Err(error) = fs::write(&metadata_path, metadata_text) {
            eprintln!("Failed to write metadata file: {:?}", error);
            return Ok(skipped_result("write_failed", Some(paper)));
        }
    } else {
        return Ok(skipped_result("write_failed", Some(paper)));
    }

    Ok(ArxivImportResult {
        status: "downloaded".to_string(),
        reason: None,
        pdf_path: Some(pdf_path.to_string_lossy().to_string()),
        pdf_size: Some(pdf_bytes.len() as u64),
        metadata_path: Some(metadata_path.to_string_lossy().to_string()),
        paper: Some(paper),
    })
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
            rename_file,
            import_arxiv_paper
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
