// tauri-tile-manager.js - Tauri-specific tile downloading and management

class TauriTileManager {
  constructor() {
    this.downloadQueue = new Map(); // Track in-progress downloads
    this.downloadStats = {
      downloaded: 0,
      cached: 0,
      failed: 0
    };
    
    // Only initialize if running in Tauri
    if (this.isTauri()) {
      this.init();
    }
  }
  
  isTauri() {
    return typeof window.__TAURI__ !== 'undefined';
  }
  
  init() {
    console.log('TauriTileManager: Initialized for native tile downloading');
    
    // Listen to map events for on-demand downloading
    if (window.map) {
      this.setupMapListeners();
    } else {
      // Wait for map to be ready
      document.addEventListener('map:ready', () => {
        this.setupMapListeners();
      });
    }
  }
  
  setupMapListeners() {
    // Listen for tile loading events
    window.map.on('tileloadstart', (e) => {
      this.onTileLoadStart(e);
    });
    
    window.map.on('tileerror', (e) => {
      this.onTileError(e);
    });
    
    window.map.on('tileload', (e) => {
      this.onTileLoad(e);
    });
  }
  
  onTileLoadStart(e) {
    // Extract tile coordinates from tile URL
    const tileInfo = this.parseTileUrl(e.url);
    if (tileInfo) {
      // Check if we have this tile locally, download if not
      this.ensureTileAvailable(tileInfo);
    }
  }
  
  onTileError(e) {
    // When a tile fails to load online, try to download it
    const tileInfo = this.parseTileUrl(e.url);
    if (tileInfo && this.isTauri()) {
      this.downloadTileInBackground(tileInfo);
    }
  }
  
  onTileLoad(e) {
    // Tile loaded successfully - could be online or cached
    this.downloadStats.cached++;
  }
  
  parseTileUrl(url) {
    // Parse OSM tile URL: https://tile.openstreetmap.org/10/512/340.png
    let match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (match) {
      return {
        z: parseInt(match[1]),
        x: parseInt(match[2]),
        y: parseInt(match[3]),
        layer_type: 'osm'
      };
    }
    
    // Parse ArcGIS satellite URL: .../tile/10/340/512
    match = url.match(/\/tile\/(\d+)\/(\d+)\/(\d+)$/);
    if (match) {
      return {
        z: parseInt(match[1]),
        y: parseInt(match[2]), // Note: ArcGIS uses y,x order
        x: parseInt(match[3]),
        layer_type: 'satellite'
      };
    }
    
    return null;
  }
  
  async ensureTileAvailable(tileInfo) {
    if (!this.isTauri()) return;
    
    const tileKey = `${tileInfo.layer_type}-${tileInfo.z}-${tileInfo.x}-${tileInfo.y}`;
    
    // Don't double-download
    if (this.downloadQueue.has(tileKey)) {
      return;
    }
    
    try {
      // Check if tile exists locally
      const exists = await window.__TAURI__.core.invoke('check_tile_exists', tileInfo);
      
      if (!exists) {
        // Download in background
        this.downloadTileInBackground(tileInfo);
      }
    } catch (error) {
      console.warn('TauriTileManager: Failed to check tile existence:', error);
    }
  }
  
  async downloadTileInBackground(tileInfo) {
    if (!this.isTauri()) return;
    
    const tileKey = `${tileInfo.layer_type}-${tileInfo.z}-${tileInfo.x}-${tileInfo.y}`;
    
    // Avoid duplicate downloads
    if (this.downloadQueue.has(tileKey)) {
      return;
    }
    
    // Mark as downloading
    this.downloadQueue.set(tileKey, Date.now());
    
    try {
      const response = await window.__TAURI__.core.invoke('download_tile', tileInfo);
      
      if (response.success) {
        if (response.cached) {
          this.downloadStats.cached++;
        } else {
          this.downloadStats.downloaded++;
          console.log(`TauriTileManager: Downloaded tile ${tileKey}`);
          
          // Notify UI about download progress
          this.notifyDownloadProgress();
        }
      } else {
        this.downloadStats.failed++;
        console.warn(`TauriTileManager: Failed to download tile ${tileKey}:`, response.error);
      }
    } catch (error) {
      this.downloadStats.failed++;
      console.error(`TauriTileManager: Error downloading tile ${tileKey}:`, error);
    } finally {
      // Remove from queue
      this.downloadQueue.delete(tileKey);
    }
  }
  
  notifyDownloadProgress() {
    // Update status manager if available
    if (window.statusManager) {
      const total = this.downloadStats.downloaded + this.downloadStats.cached + this.downloadStats.failed;
      window.statusManager.info(`Downloaded ${this.downloadStats.downloaded} tiles (${total} total)`);
    }
    
    // Emit custom event for other components
    window.dispatchEvent(new CustomEvent('tile:downloaded', {
      detail: {
        stats: { ...this.downloadStats },
        queueSize: this.downloadQueue.size
      }
    }));
  }
  
  // Download tiles for current map view
  async downloadVisibleTiles() {
    if (!this.isTauri() || !window.map) return;
    
    const bounds = window.map.getBounds();
    const zoom = window.map.getZoom();
    
    // Calculate tile bounds for current view
    const tileBounds = this.calculateTileBounds(bounds, zoom);
    
    const downloads = [];
    
    // Queue downloads for both layers
    for (let x = tileBounds.minX; x <= tileBounds.maxX; x++) {
      for (let y = tileBounds.minY; y <= tileBounds.maxY; y++) {
        downloads.push(
          this.downloadTileInBackground({ z: zoom, x, y, layer_type: 'osm' }),
          this.downloadTileInBackground({ z: zoom, x, y, layer_type: 'satellite' })
        );
      }
    }
    
    await Promise.allSettled(downloads);
    
    if (window.statusManager) {
      window.statusManager.success(`Finished downloading tiles for current view`);
    }
  }
  
  calculateTileBounds(bounds, zoom) {
    const latToTile = (lat) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    const lonToTile = (lon) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    
    return {
      minX: lonToTile(bounds.getWest()),
      maxX: lonToTile(bounds.getEast()),
      minY: latToTile(bounds.getNorth()),
      maxY: latToTile(bounds.getSouth())
    };
  }
  
  // Get download statistics
  getStats() {
    return {
      ...this.downloadStats,
      queueSize: this.downloadQueue.size,
      totalProcessed: this.downloadStats.downloaded + this.downloadStats.cached + this.downloadStats.failed
    };
  }
  
  // Clear download statistics
  resetStats() {
    this.downloadStats = {
      downloaded: 0,
      cached: 0,
      failed: 0
    };
  }
}

// Initialize if in Tauri environment
if (typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined') {
  window.tauriTileManager = new TauriTileManager();
}