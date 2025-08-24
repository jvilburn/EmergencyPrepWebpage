// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{command, Manager, Emitter};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tokio::fs;

#[derive(Debug, Serialize, Deserialize)]
struct TileRequest {
    z: u8,
    x: u32,
    y: u32,
    #[serde(rename = "layerType")]
    layer_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TileResponse {
    success: bool,
    cached: bool,
    path: Option<String>,
    error: Option<String>,
}

#[command]
async fn download_tile(
    tile_request: TileRequest,
    app_handle: tauri::AppHandle,
) -> Result<TileResponse, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let tiles_dir = app_dir.join("tiles");
    let layer_dir = tiles_dir.join(&tile_request.layer_type);
    
    // Create directory structure
    let tile_dir = if tile_request.layer_type == "satellite" {
        // ArcGIS uses z/y/x format
        layer_dir.join(tile_request.z.to_string()).join(tile_request.y.to_string())
    } else {
        // OSM uses z/x/y format
        layer_dir.join(tile_request.z.to_string()).join(tile_request.x.to_string())
    };
    
    let tile_path = if tile_request.layer_type == "satellite" {
        tile_dir.join(format!("{}.png", tile_request.x))
    } else {
        tile_dir.join(format!("{}.png", tile_request.y))
    };
    
    // Check if tile already exists
    if tile_path.exists() {
        return Ok(TileResponse {
            success: true,
            cached: true,
            path: Some(tile_path.to_string_lossy().to_string()),
            error: None,
        });
    }
    
    // Create directory structure
    fs::create_dir_all(&tile_dir).await
        .map_err(|e| format!("Failed to create tile directory: {}", e))?;
    
    // Download tile
    let url = if tile_request.layer_type == "satellite" {
        format!(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{}/{}/{}",
            tile_request.z, tile_request.y, tile_request.x
        )
    } else {
        format!(
            "https://tile.openstreetmap.org/{}/{}/{}.png",
            tile_request.z, tile_request.x, tile_request.y
        )
    };
    
    match download_and_save_tile(&url, &tile_path).await {
        Ok(_) => {
            // Update manifest after successful download
            update_manifest(&tiles_dir, &tile_request.layer_type).await?;
            
            Ok(TileResponse {
                success: true,
                cached: false,
                path: Some(tile_path.to_string_lossy().to_string()),
                error: None,
            })
        }
        Err(e) => Ok(TileResponse {
            success: false,
            cached: false,
            path: None,
            error: Some(e),
        }),
    }
}

async fn download_and_save_tile(url: &str, path: &Path) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Ward Directory Map/1.0.0")
        .send()
        .await
        .map_err(|e| format!("Failed to download tile: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    fs::write(path, &bytes).await
        .map_err(|e| format!("Failed to write tile: {}", e))?;
    
    Ok(())
}

async fn update_manifest(tiles_dir: &Path, #[allow(non_snake_case)] layerType: &str) -> Result<(), String> {
    let layer_dir = tiles_dir.join(layerType);
    if !layer_dir.exists() {
        return Ok(());
    }
    
    // Recursively find all PNG files
    let tile_results = find_tiles_recursive(layer_dir.to_path_buf(), String::new()).await?;
    
    let mut tiles = Vec::new();
    let mut zoom_levels = std::collections::HashSet::new();
    
    for (tile_path, zoom) in tile_results {
        tiles.push(tile_path);
        zoom_levels.insert(zoom);
    }
    
    let mut sorted_tiles = tiles;
    sorted_tiles.sort();
    
    let mut zoom_levels_vec: Vec<_> = zoom_levels.into_iter().collect();
    zoom_levels_vec.sort();
    
    let name = if layerType == "osm" { 
        "OpenStreetMap Tiles" 
    } else { 
        "Satellite Imagery Tiles" 
    };
    
    let format = if layerType == "osm" { "z/x/y" } else { "z/y/x" };
    
    let manifest = serde_json::json!({
        "name": name,
        "type": layerType,
        "format": format,
        "tile_count": sorted_tiles.len(),
        "tiles": sorted_tiles,
        "zoom_levels": zoom_levels_vec,
        "generated": chrono::Utc::now().to_rfc3339()
    });
    
    let manifest_path = tiles_dir.join(format!("{}-manifest.json", layerType));
    let manifest_content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| e.to_string())?;
    
    fs::write(&manifest_path, manifest_content).await
        .map_err(|e| format!("Failed to write manifest: {}", e))?;
    
    Ok(())
}

fn find_tiles_recursive(
    dir: std::path::PathBuf,
    relative_path: String,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<(String, u8)>, String>> + Send + Sync>> {
    Box::pin(async move {
        let mut result = Vec::new();
        let mut entries = fs::read_dir(&dir).await
            .map_err(|e| format!("Failed to read directory: {}", e))?;
        
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| format!("Failed to read directory entry: {}", e))? {
            
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            
            if path.is_dir() {
                let new_relative = if relative_path.is_empty() {
                    name
                } else {
                    format!("{}/{}", relative_path, name)
                };
                let mut sub_tiles = find_tiles_recursive(path, new_relative).await?;
                result.append(&mut sub_tiles);
            } else if name.ends_with(".png") {
                let tile_path = if relative_path.is_empty() {
                    name
                } else {
                    format!("{}/{}", relative_path, name)
                };
                
                // Extract zoom level for tracking
                let zoom = if let Some(zoom_str) = tile_path.split('/').next() {
                    zoom_str.parse::<u8>().unwrap_or(0)
                } else {
                    0
                };
                
                result.push((tile_path, zoom));
            }
        }
        
        Ok(result)
    })
}

#[command]
async fn check_tile_exists(
    tile_request: TileRequest,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let tiles_dir = app_dir.join("tiles");
    let layer_dir = tiles_dir.join(&tile_request.layer_type);
    
    let tile_path = if tile_request.layer_type == "satellite" {
        layer_dir
            .join(tile_request.z.to_string())
            .join(tile_request.y.to_string())
            .join(format!("{}.png", tile_request.x))
    } else {
        layer_dir
            .join(tile_request.z.to_string())
            .join(tile_request.x.to_string())
            .join(format!("{}.png", tile_request.y))
    };
    
    Ok(tile_path.exists())
}

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    // Create menu items with the app handle
    let load_csv = MenuItem::with_id(app, "load_csv", "Load CSV", true, Some("CmdOrCtrl+O"))?;
    let save_csv = MenuItem::with_id(app, "save_csv", "Save CSV", true, Some("CmdOrCtrl+S"))?;
    let legend = MenuItem::with_id(app, "legend", "Legend", true, None::<&str>)?;
    let reset_view = MenuItem::with_id(app, "reset_view", "Reset View", true, Some("CmdOrCtrl+R"))?;
    let toggle_clusters = MenuItem::with_id(app, "toggle_clusters", "Toggle Clusters", true, None::<&str>)?;
    let manage_regions = MenuItem::with_id(app, "manage_regions", "Manage Regions", true, None::<&str>)?;
    let undo_last = MenuItem::with_id(app, "undo_last", "Undo Last", true, Some("CmdOrCtrl+Z"))?;
    let clear_highlights = MenuItem::with_id(app, "clear_highlights", "Clear Highlights", true, None::<&str>)?;
    
    // Create the File menu
    let file_separator = PredefinedMenuItem::separator(app)?;
    let file_quit = PredefinedMenuItem::quit(app, None)?;
    let file_menu = Submenu::with_items(app, "File", true, &[
        &load_csv,
        &save_csv,
        &file_separator,
        &file_quit,
    ])?;
    
    // Create the Edit menu  
    let edit_separator = PredefinedMenuItem::separator(app)?;
    let edit_menu = Submenu::with_items(app, "Edit", true, &[
        &manage_regions,
        &edit_separator,
        &undo_last,
        &clear_highlights,
    ])?;
    
    // Create the View menu
    let view_menu = Submenu::with_items(app, "View", true, &[
        &legend,
        &reset_view,
        &toggle_clusters,
    ])?;
    
    // Build the menu bar
    let menu = Menu::with_items(app, &[
        &file_menu,
        &edit_menu,
        &view_menu,
    ])?;
    
    Ok(menu)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            println!("Setting up Tauri app with native menus...");
            
            let menu = build_menu(&app.handle())?;
            println!("Menu created successfully");
            
            // Try multiple approaches to set the menu
            println!("Attempting to set menu on app...");
            if let Err(e) = app.set_menu(menu.clone()) {
                println!("Failed to set menu on app: {}", e);
            } else {
                println!("Menu set on app successfully");
            }
            
            // Also try to set on the window after a delay
            let app_handle = app.handle().clone();
            let menu_clone = menu.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Err(e) = window.set_menu(menu_clone) {
                        println!("Failed to set menu on window: {}", e);
                    } else {
                        println!("Menu set on window successfully");
                    }
                }
            });
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "load_csv" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "load_csv").unwrap();
                }
                "save_csv" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "save_csv").unwrap();
                }
                "legend" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "legend").unwrap();
                }
                "reset_view" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "reset_view").unwrap();
                }
                "toggle_clusters" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "toggle_clusters").unwrap();
                }
                "manage_regions" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "manage_regions").unwrap();
                }
                "undo_last" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "undo_last").unwrap();
                }
                "clear_highlights" => {
                    app.get_webview_window("main").unwrap().emit("menu-action", "clear_highlights").unwrap();
                }
                _ => {}
            }
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            download_tile,
            check_tile_exists,
            get_tile_path,
            get_manifest
        ])
        .setup(|_app| {
            println!("Tauri app starting with native menus...");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[command]
async fn get_manifest(
    #[allow(non_snake_case)] layerType: String,
    app_handle: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let tiles_dir = app_dir.join("tiles");
    let manifest_path = tiles_dir.join(format!("{}-manifest.json", layerType));
    
    // If manifest doesn't exist, create an empty one
    if !manifest_path.exists() {
        // Ensure directory exists
        fs::create_dir_all(&tiles_dir).await
            .map_err(|e| format!("Failed to create tiles directory: {}", e))?;
        
        // Create empty manifest
        let empty_manifest = serde_json::json!({
            "name": if layerType == "osm" { "OpenStreetMap Tiles" } else { "Satellite Tiles" },
            "type": layerType,
            "format": if layerType == "osm" { "z/x/y" } else { "z/y/x" },
            "tile_count": 0,
            "tiles": [],
            "zoom_levels": [],
            "generated": chrono::Utc::now().to_rfc3339()
        });
        
        let content = serde_json::to_string_pretty(&empty_manifest)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
        
        fs::write(&manifest_path, content).await
            .map_err(|e| format!("Failed to write manifest: {}", e))?;
        
        return Ok(empty_manifest);
    }
    
    // Read existing manifest
    let content = fs::read_to_string(&manifest_path).await
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    
    let manifest: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;
    
    Ok(manifest)
}

#[command]
async fn get_tile_path(
    #[allow(non_snake_case)] layerType: String,
    z: u32,
    x: u32,
    y: u32,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let tile_path = if layerType == "satellite" {
        app_dir.join("tiles").join(&layerType).join(z.to_string()).join(y.to_string()).join(format!("{}.png", x))
    } else {
        app_dir.join("tiles").join(&layerType).join(z.to_string()).join(x.to_string()).join(format!("{}.png", y))
    };
    
    // Return the actual file path - convertFileSrc will be called on the frontend
    Ok(tile_path.to_string_lossy().to_string())
}

