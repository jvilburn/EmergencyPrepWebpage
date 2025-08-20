// tile-manager.js - Tile management and offline operations

class TileManager {
  constructor(mapManager, statusManager) {
    this.mapManager = mapManager;
    this.status = statusManager;
    
    // Tile tracking state
    this.missingTiles = {
      osm: new Set(),
      satellite: new Set()
    };
    
    // Cache for tile validation
    this.tileCache = new Map();
    this.validationPromises = new Map();
    
    // Download statistics
    this.downloadStats = {
      session: {
        osm: { detected: 0, validated: 0 },
        satellite: { detected: 0, validated: 0 }
      },
      total: {
        osm: 0,
        satellite: 0
      }
    };
    
    this.init();
  }
  
  init() {
    // Load any existing missing tiles from localStorage
    this.loadMissingTilesFromStorage();
    
    // Set up periodic validation
    this.setupPeriodicValidation();
  }
  
  // Missing tile tracking
  trackMissingTile(layerType, tileKey) {
    if (!this.missingTiles[layerType]) {
      this.missingTiles[layerType] = new Set();
    }
    
    if (!this.missingTiles[layerType].has(tileKey)) {
      this.missingTiles[layerType].add(tileKey);
      this.downloadStats.session[layerType].detected++;
      
      console.log(`Missing tile detected: ${layerType} ${tileKey}`);
      this.saveMissingTilesToStorage();
      this.updateMissingTilesUI();
      
      // Validate the tile asynchronously
      this.validateTileAsync(layerType, tileKey);
    }
  }
  
  async validateTileAsync(layerType, tileKey) {
    const cacheKey = `${layerType}:${tileKey}`;
    
    // Avoid duplicate validation requests
    if (this.validationPromises.has(cacheKey)) {
      return this.validationPromises.get(cacheKey);
    }
    
    const promise = this.validateTile(layerType, tileKey);
    this.validationPromises.set(cacheKey, promise);
    
    try {
      const isValid = await promise;
      if (isValid) {
        // Tile exists, remove from missing set
        this.missingTiles[layerType].delete(tileKey);
        this.saveMissingTilesToStorage();
        this.updateMissingTilesUI();
      } else {
        this.downloadStats.session[layerType].validated++;
      }
    } finally {
      this.validationPromises.delete(cacheKey);
    }
  }
  
  async validateTile(layerType, tileKey) {
    const [z, x, y] = tileKey.split('/').map(Number);
    
    // Build the local tile path
    let tilePath;
    if (layerType === 'satellite') {
      // ArcGIS uses z/y/x format
      tilePath = `tiles/satellite/${z}/${y}/${x}.png`;
    } else {
      // OSM uses z/x/y format
      tilePath = `tiles/osm/${z}/${x}/${y}.png`;
    }
    
    try {
      const response = await fetch(tilePath, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  // Storage management
  saveMissingTilesToStorage() {
    try {
      const data = {
        osm: Array.from(this.missingTiles.osm),
        satellite: Array.from(this.missingTiles.satellite),
        stats: this.downloadStats,
        lastUpdated: Date.now()
      };
      localStorage.setItem('ward-map-missing-tiles', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save missing tiles to localStorage:', error);
    }
  }
  
  loadMissingTilesFromStorage() {
    try {
      const data = localStorage.getItem('ward-map-missing-tiles');
      if (data) {
        const parsed = JSON.parse(data);
        
        // Restore missing tiles
        this.missingTiles.osm = new Set(parsed.osm || []);
        this.missingTiles.satellite = new Set(parsed.satellite || []);
        
        // Restore stats
        if (parsed.stats) {
          this.downloadStats = {
            ...this.downloadStats,
            total: parsed.stats.total || this.downloadStats.total
          };
        }
        
        console.log(`Loaded ${this.getTotalMissingCount()} missing tiles from storage`);
        this.updateMissingTilesUI();
      }
    } catch (error) {
      console.warn('Failed to load missing tiles from localStorage:', error);
    }
  }
  
  clearMissingTilesStorage() {
    this.missingTiles.osm.clear();
    this.missingTiles.satellite.clear();
    this.downloadStats.session = {
      osm: { detected: 0, validated: 0 },
      satellite: { detected: 0, validated: 0 }
    };
    
    localStorage.removeItem('ward-map-missing-tiles');
    console.log('Missing tiles tracking cleared');
    this.updateMissingTilesUI();
  }
  
  // UI updates
  updateMissingTilesUI() {
    const total = this.getTotalMissingCount();
    
    // Update connectivity indicator if MapManager is available
    if (this.mapManager && this.mapManager.updateConnectivityIndicator) {
      this.mapManager.updateConnectivityIndicator();
    }
    
    // Update any tile status displays
    this.updateTileStatusDisplay(total);
  }
  
  updateTileStatusDisplay(total) {
    // Update any existing tile status elements
    const statusElements = document.querySelectorAll('.tile-status');
    statusElements.forEach(element => {
      if (total > 0) {
        element.textContent = `${total} missing tiles detected`;
        element.classList.add('has-missing');
      } else {
        element.textContent = 'All tiles available offline';
        element.classList.remove('has-missing');
      }
    });
  }
  
  // Report generation
  generateMissingTilesReport() {
    const osmTiles = Array.from(this.missingTiles.osm);
    const satelliteTiles = Array.from(this.missingTiles.satellite);
    
    const report = {
      generated: new Date().toISOString(),
      total_missing: osmTiles.length + satelliteTiles.length,
      osm: {
        count: osmTiles.length,
        tiles: osmTiles.sort()
      },
      satellite: {
        count: satelliteTiles.length,
        tiles: satelliteTiles.sort()
      },
      bounds: this.getCurrentMapBounds(),
      zoom_levels: this.getCurrentZoomLevels(),
      statistics: this.downloadStats,
      validation_info: {
        note: "Tiles marked as missing have been validated - they are confirmed to not exist locally",
        recommendation: "Use the Python tile downloader with this report: python tile-downloader.py --missing-tiles missing-tiles-report.json"
      }
    };
    
    return report;
  }
  
  getCurrentMapBounds() {
    if (this.mapManager && this.mapManager.map) {
      const bounds = this.mapManager.map.getBounds();
      return {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        center: {
          lat: this.mapManager.map.getCenter().lat,
          lng: this.mapManager.map.getCenter().lng
        },
        zoom: this.mapManager.map.getZoom()
      };
    }
    return null;
  }
  
  getCurrentZoomLevels() {
    const zoomLevels = new Set();
    
    this.missingTiles.osm.forEach(tile => {
      const zoom = parseInt(tile.split('/')[0]);
      zoomLevels.add(zoom);
    });
    
    this.missingTiles.satellite.forEach(tile => {
      const zoom = parseInt(tile.split('/')[0]);
      zoomLevels.add(zoom);
    });
    
    return Array.from(zoomLevels).sort((a, b) => a - b);
  }
  
  exportMissingTilesReport() {
    const report = this.generateMissingTilesReport();
    
    if (report.total_missing === 0) {
      alert('No missing tiles detected. Navigate around the map to identify missing tiles.');
      return null;
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-tiles-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Missing tiles report exported:', report);
    this.status.success(`Exported missing tiles report: ${report.total_missing} tiles`);
    
    return report;
  }
  
  // Tile cache management
  preloadVisibleTiles() {
    if (!this.mapManager || !this.mapManager.map) return;
    
    const map = this.mapManager.map;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    // Calculate tile bounds for current view
    const tileBounds = this.calculateTileBounds(bounds, zoom);
    
    // Preload tiles in current view
    this.preloadTilesInBounds(tileBounds, zoom);
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
  
  async preloadTilesInBounds(tileBounds, zoom) {
    const promises = [];
    
    for (let x = tileBounds.minX; x <= tileBounds.maxX; x++) {
      for (let y = tileBounds.minY; y <= tileBounds.maxY; y++) {
        const tileKey = `${zoom}/${x}/${y}`;
        
        // Preload both OSM and satellite tiles
        promises.push(this.preloadTile('osm', tileKey));
        promises.push(this.preloadTile('satellite', tileKey));
      }
    }
    
    // Wait for all preload attempts (but don't fail if some tiles are missing)
    await Promise.allSettled(promises);
  }
  
  async preloadTile(layerType, tileKey) {
    const cacheKey = `${layerType}:${tileKey}`;
    
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey);
    }
    
    const [z, x, y] = tileKey.split('/').map(Number);
    
    let tilePath;
    if (layerType === 'satellite') {
      tilePath = `tiles/satellite/${z}/${y}/${x}.png`;
    } else {
      tilePath = `tiles/osm/${z}/${x}/${y}.png`;
    }
    
    try {
      const response = await fetch(tilePath);
      if (response.ok) {
        const blob = await response.blob();
        this.tileCache.set(cacheKey, blob);
        return blob;
      } else {
        // Track as missing
        this.trackMissingTile(layerType, tileKey);
        return null;
      }
    } catch (error) {
      this.trackMissingTile(layerType, tileKey);
      return null;
    }
  }
  
  // Periodic validation
  setupPeriodicValidation() {
    // Validate missing tiles every 5 minutes to check if they've been downloaded
    setInterval(() => {
      this.revalidateMissingTiles();
    }, 5 * 60 * 1000);
  }
  
  async revalidateMissingTiles() {
    const totalBefore = this.getTotalMissingCount();
    if (totalBefore === 0) return;
    
    console.log(`Revalidating ${totalBefore} missing tiles...`);
    
    const promises = [];
    
    // Revalidate OSM tiles
    for (const tileKey of this.missingTiles.osm) {
      promises.push(this.validateTileAsync('osm', tileKey));
    }
    
    // Revalidate satellite tiles
    for (const tileKey of this.missingTiles.satellite) {
      promises.push(this.validateTileAsync('satellite', tileKey));
    }
    
    await Promise.allSettled(promises);
    
    const totalAfter = this.getTotalMissingCount();
    const found = totalBefore - totalAfter;
    
    if (found > 0) {
      console.log(`Revalidation complete: ${found} tiles are now available offline`);
      this.status.success(`Found ${found} new offline tiles`);
    }
  }
  
  // Statistics and info
  getTotalMissingCount() {
    return this.missingTiles.osm.size + this.missingTiles.satellite.size;
  }
  
  getMissingTilesStats() {
    return {
      osm: this.missingTiles.osm.size,
      satellite: this.missingTiles.satellite.size,
      total: this.getTotalMissingCount(),
      session_stats: this.downloadStats.session
    };
  }
  
  showMissingTilesCount() {
    const stats = this.getMissingTilesStats();
    const sessionInfo = `\nSession detected:\nOSM: ${stats.session_stats.osm.detected} (${stats.session_stats.osm.validated} validated)\nSatellite: ${stats.session_stats.satellite.detected} (${stats.session_stats.satellite.validated} validated)`;
    
    alert(`Missing tiles tracked:\nOSM: ${stats.osm}\nSatellite: ${stats.satellite}\nTotal: ${stats.total}${sessionInfo}\n\nUse the 'Export Missing Tiles' option to download them.`);
  }
  
  // Tile download coordination
  generateDownloadInstructions() {
    const report = this.generateMissingTilesReport();
    
    if (report.total_missing === 0) {
      return "No missing tiles detected. All map data appears to be available offline.";
    }
    
    const instructions = `
Ward Map Offline Tiles - Download Instructions
==============================================

Missing Tiles Detected: ${report.total_missing}
- OSM (Street): ${report.osm.count} tiles
- Satellite: ${report.satellite.count} tiles

To download these tiles for offline use:

1. Export the missing tiles report using the 'Export Missing Tiles' button
2. Run the Python downloader with the report:
   
   python tile-downloader.py --missing-tiles missing-tiles-report.json

3. The downloader will fetch only the missing tiles identified by the app

Alternative: Full area download
If you prefer to download all tiles for your ward area:

   python tile-downloader.py --csv ward_data.csv

This will download tiles for the entire ward boundary with smart coverage
around household locations.

The downloader includes:
- Rate limiting to be respectful to tile servers
- Resume capability (skips already downloaded tiles)
- Progress reporting
- Automatic directory structure creation

After downloading, refresh the web app to use the new offline tiles.
    `.trim();
    
    return instructions;
  }
  
  showDownloadInstructions() {
    const instructions = this.generateDownloadInstructions();
    
    // Create a modal or use alert for now
    if (confirm(instructions + "\n\nWould you like to export the missing tiles report now?")) {
      this.exportMissingTilesReport();
    }
  }
  
  // Public API methods
  clearMissingTilesTracking() {
    this.clearMissingTilesStorage();
    this.status.info('Missing tiles tracking cleared');
  }
  
  // Integration with MapManager
  integrateWithMapManager(mapManager) {
    if (mapManager && mapManager.missingTiles) {
      // Sync any existing missing tiles from MapManager
      mapManager.missingTiles.osm.forEach(tile => {
        this.trackMissingTile('osm', tile);
      });
      mapManager.missingTiles.satellite.forEach(tile => {
        this.trackMissingTile('satellite', tile);
      });
      
      // Replace MapManager's missing tiles with ours
      mapManager.missingTiles = this.missingTiles;
    }
  }
}

// TileManager will be created by AppBootstrap to ensure proper initialization order

