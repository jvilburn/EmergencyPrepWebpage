// map-manager.js - Object-oriented map management class

// Hybrid tile layer that tries offline first, then online
L.TileLayer.Hybrid = L.TileLayer.extend({
  initialize: function(offlineUrlTemplate, onlineUrlTemplate, options) {
    this.offlineUrlTemplate = offlineUrlTemplate;
    this.onlineUrlTemplate = onlineUrlTemplate;
    this.onlineMode = false;
    this.layerType = options.layerType || 'osm';
    this.mapManager = options.mapManager; // Reference to MapManager instance
    
    // Tile manifest system
    this.tileManifest = null;
    this.manifestLoaded = false;
    this.manifestLoadPromise = null;
    
    L.TileLayer.prototype.initialize.call(this, offlineUrlTemplate, options);
    
    // Load tile manifest
    this.loadTileManifest();
  },
  
  loadTileManifest: function() {
    // Manifests are loaded as JavaScript variables from tiles/*-manifest.js files
    try {
      let manifest;
      if (this.layerType === 'osm' && typeof osmManifest !== 'undefined') {
        manifest = osmManifest;
      } else if (this.layerType === 'satellite' && typeof satelliteManifest !== 'undefined') {
        manifest = satelliteManifest;
      }
      
      if (manifest) {
        this.tileManifest = new Set(manifest.tiles);
        this.manifestLoaded = true;
        console.log(`Loaded ${this.layerType} tile manifest: ${manifest.tiles.length} tiles`);
        return Promise.resolve(manifest);
      } else {
        console.warn(`${this.layerType} manifest not found`);
        this.manifestLoaded = true;
        this.tileManifest = new Set();
        return Promise.resolve(null);
      }
    } catch (error) {
      console.warn(`Error loading ${this.layerType} manifest:`, error);
      this.manifestLoaded = true;
      this.tileManifest = new Set();
      return Promise.resolve(null);
    }
  },

  isTileAvailable: function(coords) {
    if (!this.manifestLoaded || !this.tileManifest) {
      return false; // Assume not available if manifest not loaded
    }
    
    // Format tile key based on layer type
    // OSM uses z/x/y format, satellite (ArcGIS) uses z/y/x format
    let tileKey;
    if (this.layerType === 'satellite') {
      tileKey = `${coords.z}/${coords.y}/${coords.x}.png`;
    } else {
      tileKey = `${coords.z}/${coords.x}/${coords.y}.png`;
    }
    
    return this.tileManifest.has(tileKey);
  },

  createTile: function(coords, done) {
    const tile = document.createElement('img');
    
    L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));
    
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }
    
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    tile.setAttribute('data-coords', JSON.stringify(coords));
    
    // Check manifest to determine tile availability
    if (this.manifestLoaded) {
      if (this.isTileAvailable(coords)) {
        // Tile is available offline, load it directly
        tile.src = this.getTileUrl(coords);
      } else {
        // Tile not in manifest, skip to online or track as missing
        this._handleMissingTile(tile, coords, done);
      }
    } else {
      // Manifest not loaded yet, wait for it
      // Preserve coords for async callback
      const tileCoords = coords;
      
      this.loadTileManifest().then(() => {
        if (this.isTileAvailable(tileCoords)) {
          tile.src = this.getTileUrl(tileCoords);
        } else {
          this._handleMissingTile(tile, tileCoords, done);
        }
      });
    }
    
    return tile;
  },

  _handleMissingTile: function(tile, coords, done) {
    const tileKey = `${coords.z}/${coords.x}/${coords.y}`;
    
    // Track missing offline tile
    if (this.mapManager && window.tileManager) {
      window.tileManager.trackMissingTile(this.layerType, tileKey);
      this.mapManager.updateConnectivityIndicator();
    }
    
    // Try online if available
    if (this.mapManager && this.mapManager.isOnline) {
      // Ensure coords are in the format Leaflet expects for getTileUrl
      console.log('Original coords:', coords, 'x:', coords.x, 'y:', coords.y, 'z:', coords.z);
      const normalizedCoords = {
        x: coords.x,
        y: coords.y,
        z: coords.z
      };
      // Manual URL generation since Leaflet's getTileUrl has issues
      const subdomains = ['a', 'b', 'c'];
      const subdomain = subdomains[Math.abs(coords.x + coords.y) % subdomains.length];
      const onlineUrl = this.onlineUrlTemplate
        .replace('{s}', subdomain)
        .replace('{z}', coords.z)
        .replace('{x}', coords.x)
        .replace('{y}', coords.y);
      console.log('Manual URL:', onlineUrl);
      tile.src = onlineUrl;
      tile.hasTriedOnline = true;
      
      // Set up success handler to track online mode
      const originalOnLoad = tile.onload;
      tile.onload = () => {
        if (!this.onlineMode) {
          this.onlineMode = true;
          this._updateAttribution();
        }
        if (originalOnLoad) originalOnLoad.call(tile);
        done(null, tile);
      };
    } else {
      // No online fallback available, show placeholder or fail gracefully
      done(new Error('Tile not available offline'), tile);
    }
  },
  
  _tileOnError: function(done, tile, e) {
    // With manifest system, this should rarely be called since we check availability first
    // This handles edge cases like corrupted files that exist in manifest but fail to load
    
    const coordsStr = tile.getAttribute('data-coords');
    let coords = {};
    
    if (coordsStr) {
      try {
        coords = JSON.parse(coordsStr);
      } catch (parseError) {
        console.warn('Failed to parse tile coords:', coordsStr);
      }
    }
    
    // Try to fall back to online if available
    if (!tile.hasTriedOnline && this.mapManager && this.mapManager.isOnline) {
      tile.hasTriedOnline = true;
      
      // Try online source as fallback
      // Manual URL generation since Leaflet's getTileUrl has issues
      const subdomains = ['a', 'b', 'c'];
      const subdomain = subdomains[Math.abs(coords.x + coords.y) % subdomains.length];
      const onlineUrl = this.onlineUrlTemplate
        .replace('{s}', subdomain)
        .replace('{z}', coords.z)
        .replace('{x}', coords.x)
        .replace('{y}', coords.y);
      tile.src = onlineUrl;
      
      // Set up success handler to track online mode
      const originalOnLoad = tile.onload;
      tile.onload = () => {
        if (!this.onlineMode) {
          this.onlineMode = true;
          this._updateAttribution();
        }
        if (originalOnLoad) originalOnLoad.call(tile);
        done(null, tile);
      };
      
      // Set up new error handler for online attempt
      const originalOnError = tile.onerror;
      tile.onerror = (e) => {
        // Both offline and online failed, use error tile
        tile.src = this.options.errorTileUrl;
        if (originalOnError) originalOnError.call(tile, e);
        done(null, tile);
      };
      
      return; // Don't call done yet, wait for online attempt
    }
    
    // All attempts failed, use error tile
    tile.src = this.options.errorTileUrl;
    done(null, tile);
  },
  
  // Note: Manifest files are maintained by the external tile downloader application
  // The web app only reads these manifests to determine tile availability

  _updateAttribution: function() {
    if (this._map && this._map.attributionControl) {
      const attribution = this.onlineMode ? 
        this.options.onlineAttribution : 
        this.options.offlineAttribution;
      
      // Update attribution
      this._map.attributionControl.removeAttribution(this.options.offlineAttribution);
      this._map.attributionControl.removeAttribution(this.options.onlineAttribution);
      this._map.attributionControl.addAttribution(attribution);
    }
  }
});

class MapManager {
  constructor(stateManager, statusManager) {
    this.state = stateManager;
    this.status = statusManager;
    
    // Map components
    this.map = null;
    this.markersLayer = null;
    this.clustersLayer = null;
    this.regionsLayer = null;
    this.streetLayer = null;
    this.satelliteLayer = null;
    
    // State variables
    this.showingClusters = true;
    this.isOnline = navigator.onLine;
    this.connectivityChecked = false;
    this.missingTiles = {
      osm: new Set(),
      satellite: new Set()
    };
    
    this.init();
  }
  
  init() {
    // Set up connectivity monitoring
    this.setupConnectivityMonitoring();
  }
  
  // Connectivity management
  setupConnectivityMonitoring() {
    window.addEventListener('online', async () => {
      this.isOnline = await this.checkConnectivity();
      this.updateConnectivityIndicator();
      console.log('Connection restored, online mode available');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateConnectivityIndicator();
      console.log('Connection lost, using offline mode only');
    });
  }
  
  async checkConnectivity() {
    return new Promise((resolve) => {
      if (!navigator.onLine) {
        resolve(false);
        return;
      }
      
      // Try to fetch a small image from a reliable CDN
      const img = new Image();
      const timeout = setTimeout(() => {
        resolve(false);
      }, 3000);
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      
      // Use a small 1x1 pixel image from a reliable CDN
      img.src = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png?' + Date.now();
    });
  }
  
  updateConnectivityIndicator() {
    const indicator = document.getElementById('connectivityIndicator');
    if (!indicator) return;
    
    if (this.isOnline) {
      indicator.textContent = '🌐 Online';
      indicator.className = 'connectivity-indicator online';
      indicator.title = 'Internet connection available - maps will load from online sources when offline tiles are not available';
    } else {
      indicator.textContent = '📱 Offline';
      indicator.className = 'connectivity-indicator offline';
      indicator.title = 'No internet connection - using offline tiles only';
    }
    
    // Add missing tiles count if any
    const total = this.missingTiles.osm.size + this.missingTiles.satellite.size;
    if (total > 0) {
      const baseText = this.isOnline ? '🌐 Online' : '📱 Offline';
      indicator.textContent = `${baseText} (${total} missing)`;
    }
  }
  
  // Map initialization
  async initMap() {
    if (this.map) return;
    
    // Check connectivity first
    if (!this.connectivityChecked) {
      this.isOnline = await this.checkConnectivity();
      this.connectivityChecked = true;
      this.updateConnectivityIndicator();
    }
    
    this.map = L.map('map', {
      zoomControl: false
    }).setView([35.9, -80.45], 10);
    
    // Add zoom control to top-right to avoid sidebar toggle
    L.control.zoom({
      position: 'topright'
    }).addTo(this.map);
    
    // Create hybrid tile layers
    this.createTileLayers();
    
    // Set up layer control
    this.setupLayerControl();
    
    // Create overlay layers
    this.createOverlayLayers();
    
    // Set up map event listeners
    this.setupMapEventListeners();
    
    // Make map available globally
    window.map = this.map;
    window.markersLayer = this.markersLayer;
    window.clustersLayer = this.clustersLayer;
    window.regionsLayer = this.regionsLayer;
  }
  
  createTileLayers() {
    // Street map layer (Hybrid: offline first, then online OpenStreetMap)
    this.streetLayer = new L.TileLayer.Hybrid(
      'tiles/osm/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap contributors',
        offlineAttribution: '© OpenStreetMap contributors | Offline Mode',
        onlineAttribution: '© OpenStreetMap contributors | Online Mode',
        maxZoom: 16,
        minZoom: 7,
        subdomains: ['a', 'b', 'c'],
        layerType: 'osm',
        mapManager: this,
        errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij5ObyBUaWxlPC90ZXh0Pjwvc3ZnPg=='
      }
    );
    
    // Satellite layer (Hybrid: offline first, then online Esri)
    this.satelliteLayer = new L.TileLayer.Hybrid(
      'tiles/satellite/{z}/{y}/{x}.png', 
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri',
        offlineAttribution: '© Esri | Offline Mode',
        onlineAttribution: '© Esri | Online Mode',
        maxZoom: 16,
        minZoom: 7,
        layerType: 'satellite',
        mapManager: this,
        errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iIzk1YTVhNiIvPjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjE0Ij5ObyBUaWxlPC90ZXh0Pjwvc3ZnPg=='
      }
    );
    
    // Suppress console errors for missing tiles
    this.suppressTileErrors();
    
    // Add street layer by default
    this.streetLayer.addTo(this.map);
  }
  
  suppressTileErrors() {
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (message.includes('tiles/') || 
          message.includes('404') || 
          message.includes('Failed to load') ||
          message.includes('ERR_FILE_NOT_FOUND') ||
          message.includes('.png') ||
          message.includes('GET file://')) {
        return; // Suppress tile loading errors
      }
      originalConsoleError.apply(console, args);
    };
  }
  
  setupLayerControl() {
    const baseMaps = {
      "🗺️ Street Map": this.streetLayer,
      "🛰️ Satellite": this.satelliteLayer
    };
    
    L.control.layers(baseMaps, null, {
      position: 'topright'
    }).addTo(this.map);
  }
  
  createOverlayLayers() {
    this.regionsLayer = L.layerGroup().addTo(this.map);
    this.clustersLayer = L.layerGroup().addTo(this.map); // Add clusters layer by default
    this.markersLayer = L.layerGroup().addTo(this.map);
  }
  
  setupMapEventListeners() {
    // Clear highlights when clicking on map background
    this.map.on('click', (e) => {
      if (!e.originalEvent.target.closest('.leaflet-marker-icon')) {
        if (window.clearHighlights) window.clearHighlights();
      }
    });
  }
  
  // Marker management
  createMapMarkers() {
    if (!this.markersLayer) return;
    
    this.markersLayer.clearLayers();
    
    // Clear markers from state manager
    this.state.clearMapMarkers();
    
    const regionStats = this.state.getRegionStats();
    
    this.state.getAllHouseholds().forEach(household => {
      // Determine color based on region/cluster assignment
      let color;
      if (household.isIsolated()) {
        color = '#95a5a6';  // Light gray for isolated
      } else if (!household.communicationsRegionName) {
        color = '#6c757d';  // Darker gray for independent clusters
      } else {
        const regionStat = regionStats.get(household.communicationsRegionName);
        if (regionStat) {
          color = regionStat.color;
        } else {
          color = '#95a5a6';  // Fallback gray
        }
      }
      
      const marker = L.circleMarker([household.lat, household.lon], {
        radius: 8,
        fillColor: color,
        color: color === '#95a5a6' || color === '#6c757d' ? '#495057' : color,  // Dark border for gray markers
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });
      
      marker.householdId = household.id;
      
      // Store marker in state manager
      this.state.setMapMarker(household.id, marker);
      
      // Add hover effects
      this.setupMarkerHoverEffects(marker, household);
      
      // Handle click events
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        // Popup will handle edit functionality via Edit button
      });
      
      this.updateMarkerPopup(household, marker);
      this.markersLayer.addLayer(marker);
    });
  }
  
  setupMarkerHoverEffects(marker, household) {
    marker.on('mouseover', function() {
      // Only apply hover if not part of highlighted set and not dimmed
      if (!window.highlightedItems || window.highlightedItems.size === 0) {
        // No active highlights, normal hover behavior
        this.setStyle({ fillOpacity: 1, weight: 3 });
      } else if (window.highlightedItems.has(household.id)) {
        // This household is highlighted, maintain highlight state
        return;
      } else {
        // Other households are highlighted, this one is dimmed - subtle hover
        this.setStyle({ radius: 7, weight: 2, opacity: 0.4, fillOpacity: 0.4 });
      }
    });
    
    marker.on('mouseout', function() {
      // Restore appropriate state based on highlights
      if (!window.highlightedItems || window.highlightedItems.size === 0) {
        // No active highlights, restore normal state
        this.setStyle({ fillOpacity: 0.8, weight: 2, opacity: 1 });
      } else if (window.highlightedItems.has(household.id)) {
        // This household is highlighted, maintain highlight state
        return;
      } else {
        // Other households are highlighted, restore dimmed state
        this.setStyle({ radius: 6, weight: 1, opacity: 0.3, fillOpacity: 0.3 });
      }
    });
  }
  
  updateMarkerPopup(household, marker) {
    let popupHtml = `<div style="font-weight: bold;">${household.name}</div>`;
    if (household.address) {
      popupHtml += `<div>📍 ${household.address}</div>`;
    }
    
    // Check for other households at same location
    const sameLocation = this.state.getAllHouseholds().filter(h => 
      h.id !== household.id && 
      Math.abs(h.lat - household.lat) < 0.000001 && 
      Math.abs(h.lon - household.lon) < 0.000001
    );
    
    if (sameLocation.length > 0) {
      popupHtml += `<div style="color: #f39c12; font-size: 12px; margin-top: 5px; border-top: 1px solid #ecf0f1; padding-top: 5px;">`;
      popupHtml += `⚠️ ${sameLocation.length} other household(s) here:<br>`;
      sameLocation.forEach(h => {
        let region;
        if (h.isIsolated()) {
          region = 'Isolated';
        } else {
          const regionPart = h.communicationsRegionName ? `R${h.communicationsRegionName}` : '';
          const clusterPart = h.communicationsClusterId > 0 ? `C${h.communicationsClusterId}` : '';
          region = regionPart + clusterPart || 'No assignment';
        }
        popupHtml += `• ${h.name} (${region})<br>`;
      });
      popupHtml += `</div>`;
    }
    
    if (household.isIsolated()) {
      popupHtml += `<div style="margin-top: 8px;"><em>Isolated Household</em></div>`;
    } else {
      popupHtml += `<div style="margin-top: 8px;">`;
      if (household.communicationsRegionName) {
        popupHtml += `Region: ${household.communicationsRegionName}<br>`;
      }
      if (household.communicationsClusterId > 0) {
        popupHtml += `Cluster: ${household.communicationsClusterId}`;
      }
      popupHtml += `</div>`;
    }
    
    // Add resource information sections
    popupHtml = this.addResourceSections(household, popupHtml);
    
    if (household.originalCommunicationsRegionName !== household.communicationsRegionName || 
        household.originalCommunicationsClusterId !== household.communicationsClusterId) {
      popupHtml += `<div style="color: red; font-weight: bold; margin-top: 5px;">*Modified*</div>`;
    }
    
    // Always show edit button
    popupHtml += `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
    popupHtml += `<button data-action="edit-household" data-household-id="${household.id}" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Edit</button>`;
    popupHtml += `</div>`;
    
    marker.bindPopup(popupHtml);
  }
  
  addResourceSections(household, popupHtml) {
    // Add special needs if any exist
    if (household.specialNeeds && household.specialNeeds.trim()) {
      popupHtml += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
      popupHtml += `<strong>Special Needs:</strong><br>${household.specialNeeds}`;
      popupHtml += `</div>`;
    }
    
    // Add medical skills if any exist
    if (household.medicalSkills && household.medicalSkills.trim()) {
      popupHtml += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
      popupHtml += `<strong>Medical Skills:</strong><br>${household.medicalSkills}`;
      popupHtml += `</div>`;
    }
    
    // Add recovery skills if any exist
    if (household.recoverySkills && household.recoverySkills.trim()) {
      popupHtml += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
      popupHtml += `<strong>Recovery Skills:</strong><br>${household.recoverySkills}`;
      popupHtml += `</div>`;
    }
    
    // Add recovery equipment if any exists
    if (household.recoveryEquipment && household.recoveryEquipment.trim()) {
      popupHtml += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
      popupHtml += `<strong>Recovery Equipment:</strong><br>${household.recoveryEquipment}`;
      popupHtml += `</div>`;
    }
    
    // Add combined communication skills and equipment if any exists
    if (household.communicationSkillsAndEquipment && household.communicationSkillsAndEquipment.trim()) {
      popupHtml += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
      popupHtml += `<strong>Communication Skills & Equipment:</strong><br>${household.communicationSkillsAndEquipment}`;
      popupHtml += `</div>`;
    }
    
    return popupHtml;
  }
  
  updateMarkerAfterChange(household) {
    const marker = this.state.getMapMarker(household.id);
    if (marker) {
      // Determine color based on region assignment
      let color;
      if (household.isIsolated()) {
        color = '#95a5a6';  // Gray for isolated
      } else if (!household.communicationsRegionName) {
        color = '#6c757d';  // Darker gray for independent clusters
      } else {
        const regionStats = this.state.getRegionStats();
        const regionStat = regionStats.get(household.communicationsRegionName);
        if (regionStat) {
          color = regionStat.color;
        } else {
          // Fallback color scheme
          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'];
          color = colors[(household.regionId - 1) % colors.length];
        }
      }
      
      marker.setStyle({
        fillColor: color,
        color: color === '#95a5a6' || color === '#6c757d' ? '#495057' : color,  // Darker border for gray markers
        fillOpacity: 0.8
      });
      
      this.updateMarkerPopup(household, marker);
    }
  }
  
  // Boundary management
  updateBoundaries() {
    if (!this.regionsLayer || !this.clustersLayer) return;
    
    this.regionsLayer.clearLayers();
    this.clustersLayer.clearLayers();
    
    const regionStats = this.state.getRegionStats();
    const clusterGroups = this.state.getClusterGroups();
    
    // Draw region boundaries with buffer
    this.drawRegionBoundaries(regionStats);
    
    // Update and draw cluster boundaries
    this.updateClusterBounds(clusterGroups, regionStats);
    this.drawClusterBoundaries(clusterGroups);
  }
  
  drawRegionBoundaries(regionStats) {
    for (const [communicationsRegionName, region] of regionStats) {
      if (region.bounds.length > 0) {
        // Create buffered boundary for region
        const bufferedBoundary = this.createBufferedBoundary(region.bounds, 0.0015); // Larger buffer for regions
        
        if (bufferedBoundary && bufferedBoundary.length > 0) {
          const polygon = L.polygon(bufferedBoundary, {
            color: region.color,
            weight: 3,
            opacity: 0.7,
            fill: true,
            fillOpacity: 0.08,
            dashArray: '10, 5',
            interactive: false,
            smoothFactor: 2.0,  // Smooth the polygon edges
            lineJoin: 'round'   // Round the corners
          });
          this.regionsLayer.addLayer(polygon);
        }
      }
    }
  }
  
  updateClusterBounds(clusterGroups, regionStats) {
    for (const [key, cluster] of clusterGroups) {
      // Get households in this cluster
      const clusterHouseholds = this.state.getAllHouseholds().filter(h => {
        if (cluster.communicationsRegionName) {
          // Regular region cluster
          return h.communicationsRegionName === cluster.communicationsRegionName && 
                 h.communicationsClusterId === cluster.communicationsClusterId;
        } else {
          // Independent cluster (no region)
          return !h.communicationsRegionName && 
                 h.communicationsClusterId === cluster.communicationsClusterId;
        }
      });
      
      // Update bounds
      cluster.bounds = clusterHouseholds.map(h => [h.lat, h.lon]);
      
      // Update color based on whether it's independent or not
      if (!cluster.communicationsRegionName) {
        cluster.color = '#6c757d';  // Darker gray for independent clusters
      } else {
        const regionStat = regionStats.get(cluster.communicationsRegionName);
        if (regionStat) {
          cluster.color = regionStat.color;
        }
      }
    }
  }
  
  drawClusterBoundaries(clusterGroups) {
    for (const [clusterKey, cluster] of clusterGroups) {
      if (cluster.bounds.length > 0) {
        // Create buffered boundary for any cluster size (default 100m buffer)
        const bufferedBoundary = this.createBufferedBoundary(cluster.bounds);
        
        if (bufferedBoundary && bufferedBoundary.length > 0) {
          const polygon = L.polygon(bufferedBoundary, {
            color: cluster.color || '#6c757d',
            weight: 2,
            opacity: 0.6,
            fill: true,
            fillOpacity: 0.05,
            dashArray: '5, 3',
            interactive: false,
            smoothFactor: 2.0,  // Smooth the polygon edges
            lineJoin: 'round'   // Round the corners
          });
          this.clustersLayer.addLayer(polygon);
        }
      }
    }
  }
  
  // Geometry utilities (moved from global functions)
  getConvexHull(points) {
    if (points.length < 3) return points;
    
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    
    const lower = [];
    for (let i = 0; i < points.length; i++) {
      while (lower.length >= 2 && this.cross(lower[lower.length-2], lower[lower.length-1], points[i]) <= 0) {
        lower.pop();
      }
      lower.push(points[i]);
    }
    
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && this.cross(upper[upper.length-2], upper[upper.length-1], points[i]) <= 0) {
        upper.pop();
      }
      upper.push(points[i]);
    }
    
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
  
  cross(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }
  
  createBufferedBoundary(points, customBufferDistance = null) {
    if (!points || points.length === 0) return null;
    
    // Buffer distance in degrees (approximately 100 meters for clusters, 150m for regions)
    const bufferDistance = customBufferDistance || 0.001; // Default roughly 100m at most latitudes
    
    if (points.length === 1) {
      return this.createCircleBoundary(points[0], bufferDistance);
    } else if (points.length === 2) {
      return this.createCapsuleBoundary(points, bufferDistance);
    } else {
      return this.createPolygonBoundary(points, bufferDistance);
    }
  }
  
  createCircleBoundary(center, bufferDistance) {
    const numPoints = 16;
    const boundary = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const lat = center[0] + bufferDistance * Math.sin(angle);
      const lon = center[1] + bufferDistance * Math.cos(angle) / Math.cos(center[0] * Math.PI / 180);
      boundary.push([lat, lon]);
    }
    return boundary;
  }
  
  createCapsuleBoundary(points, bufferDistance) {
    const p1 = points[0];
    const p2 = points[1];
    
    // Calculate perpendicular direction
    const dx = p2[1] - p1[1];
    const dy = p2[0] - p1[0];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      // Points are the same, treat as single point
      return this.createCircleBoundary(p1, bufferDistance);
    }
    
    const boundary = [];
    const numArcPoints = 8;
    
    // First arc around p1
    for (let i = 0; i <= numArcPoints; i++) {
      const angle = Math.PI * (0.5 + i / numArcPoints);
      const offsetX = bufferDistance * Math.cos(angle);
      const offsetY = bufferDistance * Math.sin(angle) / Math.cos(p1[0] * Math.PI / 180);
      
      // Rotate offset to align with line direction
      const rotX = offsetX * dx / length - offsetY * dy / length;
      const rotY = offsetX * dy / length + offsetY * dx / length;
      
      boundary.push([p1[0] + rotY, p1[1] + rotX]);
    }
    
    // Second arc around p2
    for (let i = 0; i <= numArcPoints; i++) {
      const angle = Math.PI * (1.5 + i / numArcPoints);
      const offsetX = bufferDistance * Math.cos(angle);
      const offsetY = bufferDistance * Math.sin(angle) / Math.cos(p2[0] * Math.PI / 180);
      
      // Rotate offset to align with line direction
      const rotX = offsetX * dx / length - offsetY * dy / length;
      const rotY = offsetX * dy / length + offsetY * dx / length;
      
      boundary.push([p2[0] + rotY, p2[1] + rotX]);
    }
    
    return boundary;
  }
  
  createPolygonBoundary(points, bufferDistance) {
    // Multiple points: create convex hull then buffer it
    const hull = this.getConvexHull(points);
    if (!hull || hull.length < 3) return null;
    
    // Create buffered polygon by offsetting each edge
    const bufferedPoints = [];
    const n = hull.length;
    
    for (let i = 0; i < n; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % n];
      const p0 = hull[(i - 1 + n) % n];
      
      // Calculate edge vectors and create buffered boundary point
      const bufferedPoint = this.calculateBufferedPoint(p0, p1, p2, bufferDistance);
      if (bufferedPoint) {
        bufferedPoints.push(bufferedPoint);
      }
    }
    
    return bufferedPoints;
  }
  
  calculateBufferedPoint(p0, p1, p2, bufferDistance) {
    // Calculate edge vectors
    const v1x = p1[1] - p0[1];
    const v1y = p1[0] - p0[0];
    const v2x = p2[1] - p1[1];
    const v2y = p2[0] - p1[0];
    
    // Normalize vectors
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    
    if (len1 === 0 || len2 === 0) return null;
    
    const n1x = -v1y / len1;
    const n1y = v1x / len1;
    const n2x = -v2y / len2;
    const n2y = v2x / len2;
    
    // Average normal (bisector)
    let nx = n1x + n2x;
    let ny = n1y + n2y;
    let nlen = Math.sqrt(nx * nx + ny * ny);
    
    if (nlen === 0) {
      nx = n1x;
      ny = n1y;
      nlen = 1;
    } else {
      nx /= nlen;
      ny /= nlen;
    }
    
    // Calculate angle between edges
    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const halfAngle = (Math.PI - angle) / 2;
    
    // Calculate offset distance with safety limits
    let offsetDist;
    if (halfAngle < Math.PI / 6) { // Acute angle
      offsetDist = bufferDistance * 2;
    } else {
      offsetDist = bufferDistance / Math.sin(halfAngle);
      offsetDist = Math.min(offsetDist, bufferDistance * 3); // Cap at 3x buffer
    }
    
    // Apply offset
    const offsetX = nx * offsetDist;
    const offsetY = ny * offsetDist / Math.cos(p1[0] * Math.PI / 180);
    
    return [p1[0] + offsetY, p1[1] + offsetX];
  }
  
  // View controls
  resetView() {
    const households = this.state.getAllHouseholds();
    if (households.length > 0 && this.map) {
      const bounds = households.map(h => [h.lat, h.lon]);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
  
  toggleClusters() {
    if (!this.map || !this.clustersLayer) return;
    
    this.showingClusters = !this.showingClusters;
    const btn = document.getElementById('clusterBtn');
    
    if (this.showingClusters) {
      this.map.addLayer(this.clustersLayer);
      if (btn) btn.textContent = '👁️ Hide Clusters';
    } else {
      this.map.removeLayer(this.clustersLayer);
      if (btn) btn.textContent = '👁️ Show Clusters';
    }
  }
  
  // Missing tiles management
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
      zoom_levels: this.getCurrentZoomLevels()
    };
    
    return report;
  }
  
  getCurrentMapBounds() {
    if (!this.map) return null;
    
    const bounds = this.map.getBounds();
    return {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
      center: {
        lat: this.map.getCenter().lat,
        lng: this.map.getCenter().lng
      },
      zoom: this.map.getZoom()
    };
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
  
  
  // Public methods
  getMap() {
    return this.map;
  }
  
  getMarkersLayer() {
    return this.markersLayer;
  }
  
  getClustersLayer() {
    return this.clustersLayer;
  }
  
  getRegionsLayer() {
    return this.regionsLayer;
  }
}

// Create and export global instance after dependencies are loaded
// MapManager will be created by TileManager to ensure proper initialization order


