// map.js - Map functionality and marker management

// Global map variables
let map = null;
let markersLayer = null;
let clustersLayer = null;
let regionsLayer = null;
let markers = {};
let streetLayer = null;
let satelliteLayer = null;
let showingClusters = true;

// Custom tile layer with fallback to lower zoom levels
L.TileLayer.Fallback = L.TileLayer.extend({
  _tileOnError: function(done, tile, e) {
    // Immediately use transparent placeholder to avoid multiple failed requests
    tile.src = this.options.errorTileUrl;
    
    // Prevent the error from bubbling up to avoid console messages
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  
  _loadTile: function(tile, coords) {
    tile.setAttribute('data-key', coords.x + ':' + coords.y);
    L.TileLayer.prototype._loadTile.call(this, tile, coords);
  }
});

// Initialize map with offline tiles
function initMap() {
  if (map) return;
  
  map = L.map('map', {
    zoomControl: false
  }).setView([35.9, -80.45], 10);
  
  // Add zoom control to top-right to avoid sidebar toggle
  L.control.zoom({
    position: 'topright'
  }).addTo(map);
  
  // Street map layer (OpenStreetMap tiles) with fallback
  streetLayer = new L.TileLayer.Fallback('tiles/osm/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors | Offline Mode',
    maxZoom: 16,
    minZoom: 7,
    errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y4ZjlmYSIvPjwvc3ZnPg=='
  });
  
  // Satellite layer (ArcGIS tiles) with fallback
  satelliteLayer = new L.TileLayer.Fallback('tiles/satellite/{z}/{y}/{x}.png', {
    attribution: '© Esri | Offline Mode',
    maxZoom: 16,
    minZoom: 7,
    errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iIzk1YTVhNiIvPjwvc3ZnPg=='
  });
  
  // Suppress console errors for missing tiles more comprehensively
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
  
  // Add street layer by default
  streetLayer.addTo(map);
  
  // Add layer control
  const baseMaps = {
    "🗺️ Street Map": streetLayer,
    "🛰️ Satellite": satelliteLayer
  };
  
  L.control.layers(baseMaps, null, {
    position: 'topright'
  }).addTo(map);
  
  // Create overlay layers
  regionsLayer = L.layerGroup().addTo(map);
  clustersLayer = L.layerGroup().addTo(map); // Add clusters layer by default
  markersLayer = L.layerGroup().addTo(map);
  
  // Clear highlights when clicking on map background
  map.on('click', function(e) {
    if (!e.originalEvent.target.closest('.leaflet-marker-icon')) {
      if (window.clearHighlights) window.clearHighlights();
    }
  });
  
  // Make map available globally
  window.map = map;
  window.markersLayer = markersLayer;
  window.clustersLayer = clustersLayer;
  window.regionsLayer = regionsLayer;
  window.markers = markers;
}

// Create map markers for all households
function createMapMarkers() {
  if (!markersLayer) return;
  
  markersLayer.clearLayers();
  markers = {};
  
  wardData.forEach(household => {
    // Determine color based on region/cluster assignment
    let color;
    if (household.isIsolated) {
      color = '#95a5a6';  // Light gray for isolated
    } else if (household.regionId === 0) {
      color = '#6c757d';  // Darker gray for independent clusters
    } else if (regionStats[household.regionId]) {
      color = regionStats[household.regionId].color;
    } else {
      color = '#95a5a6';  // Fallback gray
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
    markers[household.id] = marker;
    
    // Add hover effects
    marker.on('mouseover', function() {
      if (!window.highlightedItems || !window.highlightedItems.has(household.id)) {
        this.setStyle({ fillOpacity: 1, weight: 3 });
      }
    });
    
    marker.on('mouseout', function() {
      if (!window.highlightedItems || !window.highlightedItems.has(household.id)) {
        this.setStyle({ fillOpacity: 0.9, weight: 2 });
      }
    });
    
    // Handle click events - just open popup now (edit button is in popup)
    marker.on('click', function(e) {
      L.DomEvent.stopPropagation(e);
      // Popup will handle edit functionality via Edit button
    });
    
    updateMarkerPopup(household, marker);
    markersLayer.addLayer(marker);
  });
  
  window.markers = markers;
}

// Handle marker click in edit mode (legacy function)
function handleMarkerClick(household) {
  handleEditHousehold(household.id);
}

// Handle edit household from popup button
window.handleEditHousehold = function(householdId) {
  const household = wardData.find(h => h.id === householdId);
  if (!household) return;
  
  // Check for other households at same location
  const sameLocation = wardData.filter(h => 
    Math.abs(h.lat - household.lat) < 0.000001 && 
    Math.abs(h.lon - household.lon) < 0.000001
  );
  
  if (sameLocation.length > 1) {
    // Show selection dialog for multiple households
    if (window.showHouseholdSelectionDialog) {
      window.showHouseholdSelectionDialog(sameLocation);
    }
  } else {
    // Single household - open edit dialog directly
    if (window.openReassignDialog) {
      window.openReassignDialog(household);
    }
  }
}

// Update marker popup content
function updateMarkerPopup(household, marker) {
  let popupHtml = `<div style="font-weight: bold;">${household.name}</div>`;
  if (household.address) {
    popupHtml += `<div>📍 ${household.address}</div>`;
  }
  
  // Check for other households at same location
  const sameLocation = wardData.filter(h => 
    h.id !== household.id && 
    Math.abs(h.lat - household.lat) < 0.000001 && 
    Math.abs(h.lon - household.lon) < 0.000001
  );
  
  if (sameLocation.length > 0) {
    popupHtml += `<div style="color: #f39c12; font-size: 12px; margin-top: 5px; border-top: 1px solid #ecf0f1; padding-top: 5px;">`;
    popupHtml += `⚠️ ${sameLocation.length} other household(s) here:<br>`;
    sameLocation.forEach(h => {
      let region;
      if (h.isIsolated) {
        region = 'Isolated';
      } else {
        const regionPart = h.regionId > 0 ? `R${h.regionId}` : '';
        const clusterPart = h.clusterId > 0 ? `C${h.clusterId}` : '';
        region = regionPart + clusterPart || 'No assignment';
      }
      popupHtml += `• ${h.name} (${region})<br>`;
    });
    popupHtml += `</div>`;
  }
  
  if (household.isIsolated) {
    popupHtml += `<div style="margin-top: 8px;"><em>Isolated Household</em></div>`;
  } else {
    popupHtml += `<div style="margin-top: 8px;">`;
    if (household.regionId > 0 && household.regionName) {
      popupHtml += `Region: ${household.regionName}<br>`;
    }
    if (household.clusterId > 0) {
      popupHtml += `Cluster: ${household.clusterId}`;
    }
    popupHtml += `</div>`;
  }
  
  // Add special needs if any exist (shows first now)
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
  
  if (household.originalRegionId !== household.regionId || 
      household.originalClusterId !== household.clusterId) {
    popupHtml += `<div style="color: red; font-weight: bold; margin-top: 5px;">*Modified*</div>`;
  }
  
  // Always show edit button (no global edit mode anymore)
  popupHtml += `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #ecf0f1;">`;
  if (sameLocation.length > 0) {
    popupHtml += `<button onclick="handleEditHousehold('${household.id}')" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Edit</button>`;
  } else {
    popupHtml += `<button onclick="handleEditHousehold('${household.id}')" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Edit</button>`;
  }
  popupHtml += `</div>`;
  
  marker.bindPopup(popupHtml);
}

// Update marker after assignment change
function updateMarkerAfterChange(household) {
  const marker = markers[household.id];
  if (marker) {
    // Determine color based on region assignment
    let color;
    if (household.isIsolated) {
      color = '#95a5a6';  // Gray for isolated
    } else if (household.regionId === 0) {
      color = '#6c757d';  // Darker gray for independent clusters
    } else if (regionStats[household.regionId]) {
      color = regionStats[household.regionId].color;
    } else {
      color = COLORS[(household.regionId - 1) % COLORS.length];
    }
    
    marker.setStyle({
      fillColor: color,
      color: color === '#95a5a6' || color === '#6c757d' ? '#495057' : color,  // Darker border for gray markers
      fillOpacity: 0.8
    });
    
    updateMarkerPopup(household, marker);
  }
}

// Create a buffered boundary around points
function createBufferedBoundary(points, customBufferDistance = null) {
  if (!points || points.length === 0) return null;
  
  // Buffer distance in degrees (approximately 100 meters for clusters, 150m for regions)
  const bufferDistance = customBufferDistance || 0.001; // Default roughly 100m at most latitudes
  
  if (points.length === 1) {
    // Single point: create a circle
    const center = points[0];
    const numPoints = 16;
    const boundary = [];
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const lat = center[0] + bufferDistance * Math.sin(angle);
      const lon = center[1] + bufferDistance * Math.cos(angle) / Math.cos(center[0] * Math.PI / 180);
      boundary.push([lat, lon]);
    }
    return boundary;
    
  } else if (points.length === 2) {
    // Two points: create a capsule shape
    const p1 = points[0];
    const p2 = points[1];
    
    // Calculate perpendicular direction
    const dx = p2[1] - p1[1];
    const dy = p2[0] - p1[0];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      // Points are the same, treat as single point
      return createBufferedBoundary([p1]);
    }
    
    // Normalized perpendicular vector
    const perpX = -dy / length * bufferDistance;
    const perpY = dx / length * bufferDistance / Math.cos(p1[0] * Math.PI / 180);
    
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
    
  } else {
    // Multiple points: create convex hull then buffer it
    const hull = getConvexHull(points);
    if (!hull || hull.length < 3) return null;
    
    // Create buffered polygon by offsetting each edge
    const bufferedPoints = [];
    const n = hull.length;
    
    for (let i = 0; i < n; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % n];
      const p0 = hull[(i - 1 + n) % n];
      
      // Calculate edge vectors
      const v1x = p1[1] - p0[1];
      const v1y = p1[0] - p0[0];
      const v2x = p2[1] - p1[1];
      const v2y = p2[0] - p1[0];
      
      // Normalize vectors
      const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
      
      if (len1 === 0 || len2 === 0) continue;
      
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
      
      // For very acute angles, use a different approach
      if (halfAngle < Math.PI / 8) { // Very acute angle (< 22.5 degrees)
        // Create a rounded corner by adding multiple points in an arc
        const numArcPoints = 8;
        const arcRadius = bufferDistance * 1.5; // Larger radius for acute angles
        
        // Find the center of the arc (intersection of offset lines)
        const offset1X = n1x * arcRadius;
        const offset1Y = n1y * arcRadius / Math.cos(p1[0] * Math.PI / 180);
        const offset2X = n2x * arcRadius;
        const offset2Y = n2y * arcRadius / Math.cos(p1[0] * Math.PI / 180);
        
        // Add arc points
        for (let j = 0; j <= numArcPoints; j++) {
          const t = j / numArcPoints;
          const arcAngle = Math.atan2(n1y, n1x) + t * (Math.atan2(n2y, n2x) - Math.atan2(n1y, n1x));
          
          // Normalize angle difference
          let angleDiff = Math.atan2(n2y, n2x) - Math.atan2(n1y, n1x);
          if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          
          const currentAngle = Math.atan2(n1y, n1x) + t * angleDiff;
          const offsetX = Math.cos(currentAngle) * arcRadius;
          const offsetY = Math.sin(currentAngle) * arcRadius / Math.cos(p1[0] * Math.PI / 180);
          
          bufferedPoints.push([p1[0] + offsetY, p1[1] + offsetX]);
        }
        
      } else {
        // Normal case: calculate miter offset
        let offsetDist;
        
        if (halfAngle < Math.PI / 6) { // Still quite acute (< 30 degrees)
          // Use a fixed offset to avoid extreme values
          offsetDist = bufferDistance * 2;
        } else {
          // Standard miter calculation with safety limits
          offsetDist = bufferDistance / Math.sin(halfAngle);
          offsetDist = Math.min(offsetDist, bufferDistance * 3); // Cap at 3x buffer
        }
        
        // Apply offset
        const offsetX = nx * offsetDist;
        const offsetY = ny * offsetDist / Math.cos(p1[0] * Math.PI / 180);
        
        bufferedPoints.push([p1[0] + offsetY, p1[1] + offsetX]);
        
        // Add extra points for rounded corners if the angle is sharp enough
        if (halfAngle < Math.PI / 3) { // Less than 60 degrees
          const numCornerPoints = Math.ceil((Math.PI / 3 - halfAngle) / (Math.PI / 12)) + 1;
          
          for (let j = 1; j < numCornerPoints; j++) {
            const t = j / numCornerPoints;
            
            // Interpolate between the two normals
            const mx = n1x * (1 - t) + n2x * t;
            const my = n1y * (1 - t) + n2y * t;
            const mlen = Math.sqrt(mx * mx + my * my);
            
            if (mlen > 0) {
              const cornerX = (mx / mlen) * bufferDistance * 1.2; // Slightly larger for smoother corners
              const cornerY = (my / mlen) * bufferDistance * 1.2 / Math.cos(p1[0] * Math.PI / 180);
              bufferedPoints.push([p1[0] + cornerY, p1[1] + cornerX]);
            }
          }
        }
      }
    }
    
    return bufferedPoints;
  }
}

// Update region and cluster boundaries
function updateBoundaries() {
  if (!regionsLayer || !clustersLayer) return;
  
  regionsLayer.clearLayers();
  clustersLayer.clearLayers();
  
  // Draw region boundaries with buffer
  Object.entries(regionStats).forEach(([regionId, region]) => {
    if (region.bounds.length > 0) {
      // Create buffered boundary for region
      const bufferedBoundary = createBufferedBoundary(region.bounds, 0.0015); // Larger buffer for regions
      
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
        regionsLayer.addLayer(polygon);
      }
    }
  });
  
  // Update cluster bounds and rebuild clusterGroups for independent clusters
  Object.keys(clusterGroups).forEach(key => {
    const cluster = clusterGroups[key];
    const [regionId, clusterId] = key.split('-').map(Number);
    
    // Get households in this cluster
    const clusterHouseholds = wardData.filter(h => 
      h.regionId === regionId && h.clusterId === clusterId
    );
    
    // Update bounds
    cluster.bounds = clusterHouseholds.map(h => [h.lat, h.lon]);
    
    // Update color based on whether it's independent or not
    if (regionId === 0) {
      cluster.color = '#6c757d';  // Darker gray for independent clusters
    } else if (regionStats[regionId]) {
      cluster.color = regionStats[regionId].color;
    }
  });
  
  // Draw cluster boundaries with buffer
  Object.entries(clusterGroups).forEach(([clusterKey, cluster]) => {
    if (cluster.bounds.length > 0) {
      // Create buffered boundary for any cluster size (default 100m buffer)
      const bufferedBoundary = createBufferedBoundary(cluster.bounds);
      
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
        clustersLayer.addLayer(polygon);
      }
    }
  });
}

// Reset map view to show all households
function resetView() {
  if (wardData.length > 0 && map) {
    const bounds = wardData.map(h => [h.lat, h.lon]);
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// Toggle cluster boundaries visibility
function toggleClusters() {
  if (!map || !clustersLayer) return;
  
  showingClusters = !showingClusters;
  const btn = document.getElementById('clusterBtn');
  
  if (showingClusters) {
    map.addLayer(clustersLayer);
    btn.textContent = '👁️ Hide Clusters';
  } else {
    map.removeLayer(clustersLayer);
    btn.textContent = '👁️ Show Clusters';
  }
}

// Expose functions globally
window.initMap = initMap;
window.createMapMarkers = createMapMarkers;
window.updateMarkerPopup = updateMarkerPopup;
window.updateMarkerAfterChange = updateMarkerAfterChange;
window.updateBoundaries = updateBoundaries;
window.resetView = resetView;
window.toggleClusters = toggleClusters;