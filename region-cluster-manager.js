// region-cluster-manager.js - Enhanced region and cluster management functionality

// State for region/cluster management
let regionManagementState = {
  mode: null, // null, 'create-region', 'create-cluster', 'select-households', 'select-clusters'
  selectedItems: new Set(),
  currentRegion: null,
  currentCluster: null,
  selectionRectangle: null,
  isDrawing: false,
  startPoint: null
};

// Get next available region ID
function getNextRegionId() {
  const existingIds = wardData
    .filter(h => !h.isIsolated && h.regionId > 0)
    .map(h => h.regionId);
  return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
}

// Get next available cluster ID for a region
function getNextClusterId(regionId) {
  const existingIds = wardData
    .filter(h => h.regionId === regionId)
    .map(h => h.clusterId);
  return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
}

// Create new region
function createNewRegion(name) {
  const regionId = getNextRegionId();
  const regionName = name || `Region ${regionId}`;
  
  // Add to regionStats
  if (!regionStats[regionId]) {
    regionStats[regionId] = {
      name: regionName,
      count: 0,
      color: COLORS[(regionId - 1) % COLORS.length],
      bounds: [],
      clusters: new Set()
    };
  }
  
  return { id: regionId, name: regionName };
}

// Create new cluster in a region
function createNewCluster(regionId, regionName) {
  const clusterId = getNextClusterId(regionId);
  const clusterKey = `${regionId}-${clusterId}`;
  
  // Ensure region exists
  if (!regionStats[regionId]) {
    regionStats[regionId] = {
      name: regionName || `Region ${regionId}`,
      count: 0,
      color: COLORS[(regionId - 1) % COLORS.length],
      bounds: [],
      clusters: new Set()
    };
  }
  
  regionStats[regionId].clusters.add(clusterId);
  
  // Add to clusterGroups
  if (!clusterGroups[clusterKey]) {
    clusterGroups[clusterKey] = {
      regionId: regionId,
      clusterId: clusterId,
      color: regionStats[regionId].color,
      bounds: []
    };
  }
  
  return { regionId, clusterId, clusterKey };
}

// Delete region but preserve clusters as independent
function deleteRegion(regionId) {
  const affectedHouseholds = wardData.filter(h => h.regionId === regionId);
  const regionName = regionStats[regionId]?.name || `Region ${regionId}`;
  
  if (affectedHouseholds.length > 0) {
    
    affectedHouseholds.forEach(household => {
      // Record change
      changes.push({
        householdId: household.id,
        householdName: household.name,
        fromRegion: household.regionId,
        fromCluster: household.clusterId,
        fromRegionName: household.regionName,
        toRegion: 0, // 0 means no region (but still in cluster)
        toCluster: household.clusterId, // Keep same cluster
        toRegionName: '',
        timestamp: new Date().toISOString()
      });
      
      // Update household - keep cluster but remove region
      household.regionId = 0;
      household.regionName = '';
      // Keep clusterId unchanged
      // Not isolated since they're still in a cluster
      household.isIsolated = false;
    });
    
    // Update clusterGroups to mark clusters as region-less
    Object.keys(clusterGroups).forEach(key => {
      if (clusterGroups[key].regionId === regionId) {
        clusterGroups[key].regionId = 0; // Mark as region-less
      }
    });
  }
  
  // Remove from regionStats
  delete regionStats[regionId];
  
  // Recalculate statistics to properly rebuild independent clusters
  recalculateStatistics();
  
  // Update all markers to reflect the change
  affectedHouseholds.forEach(household => {
    if (window.updateMarkerAfterChange) {
      window.updateMarkerAfterChange(household);
    }
  });
  
  // Rebuild boundaries to show independent clusters properly
  if (window.updateBoundaries) {
    window.updateBoundaries();
  }
  
  // Update other UI components
  if (window.showStatistics) window.showStatistics();
  if (window.showLegend) window.showLegend();
  if (window.updateChangesCounter) window.updateChangesCounter();
  if (window.buildHouseholdList) window.buildHouseholdList();
  saveDataLocally();
  
  return true;
}

// Delete cluster and reassign households
function deleteCluster(regionId, clusterId) {
  const clusterKey = `${regionId}-${clusterId}`;
  const affectedHouseholds = wardData.filter(h => 
    h.regionId === regionId && h.clusterId === clusterId
  );
  
  if (affectedHouseholds.length > 0) {
    // Record changes and remove cluster assignment but keep households in region
    affectedHouseholds.forEach(household => {
      // Record change
      changes.push({
        householdId: household.id,
        householdName: household.name,
        fromRegion: household.regionId,
        fromCluster: household.clusterId,
        fromRegionName: household.regionName,
        toRegion: household.regionId, // Keep in same region
        toCluster: 0, // Remove cluster assignment
        toRegionName: household.regionName,
        timestamp: new Date().toISOString()
      });
      
      // Remove cluster but keep region
      household.clusterId = 0;
      // Keep regionId and regionName unchanged
      // Keep isIsolated as false since they're still in a region
      
      // Update marker popup to reflect the change
      if (window.updateMarkerAfterChange) {
        window.updateMarkerAfterChange(household);
      }
    });
  }
  
  // Remove from regionStats
  regionStats[regionId].clusters.delete(clusterId);
  
  // Remove from clusterGroups
  delete clusterGroups[clusterKey];
  
  return true;
}

// Start selection mode for households
function startHouseholdSelection(targetRegionId, targetClusterId) {
  regionManagementState.mode = 'select-households';
  regionManagementState.currentRegion = targetRegionId;
  regionManagementState.currentCluster = targetClusterId;
  regionManagementState.selectedItems.clear();
  
  // Update UI
  showSelectionInstructions('household');
  enableMapSelection();
}

// Start selection mode for clusters
function startClusterSelection(targetRegionId) {
  regionManagementState.mode = 'select-clusters';
  regionManagementState.currentRegion = targetRegionId;
  regionManagementState.selectedItems.clear();
  
  // Update UI
  showSelectionInstructions('cluster');
  enableMapSelection();
}

// Enable map selection tools
function enableMapSelection() {
  if (!window.map) return;
  
  // Change cursor
  window.map.getContainer().style.cursor = 'crosshair';
  
  // Disable map dragging temporarily
  window.map.dragging.disable();
  
  // Add rectangle selection handlers
  window.map.on('mousedown', startRectangleSelection);
  window.map.on('mousemove', updateRectangleSelection);
  window.map.on('mouseup', endRectangleSelection);
  
  // Add click selection for individual items
  window.map.on('click', handleMapClick);
}

// Disable map selection tools
function disableMapSelection() {
  if (!window.map) return;
  
  // Reset cursor
  window.map.getContainer().style.cursor = '';
  
  // Re-enable map dragging
  window.map.dragging.enable();
  
  // Remove selection handlers
  window.map.off('mousedown', startRectangleSelection);
  window.map.off('mousemove', updateRectangleSelection);
  window.map.off('mouseup', endRectangleSelection);
  window.map.off('click', handleMapClick);
  
  // Clear selection rectangle if exists
  if (regionManagementState.selectionRectangle) {
    window.map.removeLayer(regionManagementState.selectionRectangle);
    regionManagementState.selectionRectangle = null;
  }
}

// Start rectangle selection
function startRectangleSelection(e) {
  regionManagementState.isDrawing = true;
  regionManagementState.startPoint = e.latlng;
  
  // Create selection rectangle
  const bounds = L.latLngBounds(e.latlng, e.latlng);
  regionManagementState.selectionRectangle = L.rectangle(bounds, {
    color: '#3388ff',
    weight: 2,
    opacity: 0.5,
    fillOpacity: 0.2,
    dashArray: '5, 5'
  }).addTo(window.map);
}

// Update rectangle selection
function updateRectangleSelection(e) {
  if (!regionManagementState.isDrawing || !regionManagementState.selectionRectangle) return;
  
  const bounds = L.latLngBounds(regionManagementState.startPoint, e.latlng);
  regionManagementState.selectionRectangle.setBounds(bounds);
}

// End rectangle selection
function endRectangleSelection(e) {
  if (!regionManagementState.isDrawing) return;
  
  regionManagementState.isDrawing = false;
  
  if (regionManagementState.selectionRectangle) {
    const bounds = regionManagementState.selectionRectangle.getBounds();
    
    // Select items within bounds
    if (regionManagementState.mode === 'select-households') {
      selectHouseholdsInBounds(bounds);
    } else if (regionManagementState.mode === 'select-clusters') {
      selectClustersInBounds(bounds);
    }
    
    // Remove rectangle
    window.map.removeLayer(regionManagementState.selectionRectangle);
    regionManagementState.selectionRectangle = null;
  }
}

// Handle individual map clicks
function handleMapClick(e) {
  if (regionManagementState.isDrawing) return;
  
  // Find closest household
  let closestHousehold = null;
  let minDistance = Infinity;
  
  wardData.forEach(household => {
    const distance = window.map.distance(e.latlng, [household.lat, household.lon]);
    if (distance < minDistance && distance < 20) { // Within 20 meters
      minDistance = distance;
      closestHousehold = household;
    }
  });
  
  if (closestHousehold) {
    if (regionManagementState.mode === 'select-households') {
      toggleHouseholdSelection(closestHousehold);
    } else if (regionManagementState.mode === 'select-clusters' && !closestHousehold.isIsolated) {
      toggleClusterSelection(closestHousehold.regionId, closestHousehold.clusterId);
    }
  }
}

// Select households within bounds
function selectHouseholdsInBounds(bounds) {
  wardData.forEach(household => {
    const point = L.latLng(household.lat, household.lon);
    if (bounds.contains(point)) {
      regionManagementState.selectedItems.add(household.id);
      highlightHousehold(household.id, true);
    }
  });
  
  updateSelectionStatus();
}

// Select clusters within bounds
function selectClustersInBounds(bounds) {
  const clustersInBounds = new Set();
  
  wardData.forEach(household => {
    if (!household.isIsolated) {
      const point = L.latLng(household.lat, household.lon);
      if (bounds.contains(point)) {
        const clusterKey = `${household.regionId}-${household.clusterId}`;
        clustersInBounds.add(clusterKey);
      }
    }
  });
  
  clustersInBounds.forEach(clusterKey => {
    regionManagementState.selectedItems.add(clusterKey);
    highlightCluster(clusterKey, true);
  });
  
  updateSelectionStatus();
}

// Toggle household selection
function toggleHouseholdSelection(household) {
  if (regionManagementState.selectedItems.has(household.id)) {
    regionManagementState.selectedItems.delete(household.id);
    highlightHousehold(household.id, false);
  } else {
    regionManagementState.selectedItems.add(household.id);
    highlightHousehold(household.id, true);
  }
  
  updateSelectionStatus();
}

// Toggle cluster selection
function toggleClusterSelection(regionId, clusterId) {
  const clusterKey = `${regionId}-${clusterId}`;
  
  if (regionManagementState.selectedItems.has(clusterKey)) {
    regionManagementState.selectedItems.delete(clusterKey);
    highlightCluster(clusterKey, false);
  } else {
    regionManagementState.selectedItems.add(clusterKey);
    highlightCluster(clusterKey, true);
  }
  
  updateSelectionStatus();
}

// Highlight household on map
function highlightHousehold(householdId, highlight) {
  const marker = window.markers[householdId];
  if (marker) {
    if (highlight) {
      marker.setStyle({
        radius: 10,
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
        color: '#ff6b6b'
      });
    } else {
      // Reset to original style
      const household = wardData.find(h => h.id === householdId);
      const color = household.isIsolated ? '#6c757d' : 
                   regionStats[household.regionId]?.color || '#007bff';
      marker.setStyle({
        radius: 6,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.6,
        color: color,
        fillColor: color
      });
    }
  }
}

// Highlight cluster on map
function highlightCluster(clusterKey, highlight) {
  const [regionId, clusterId] = clusterKey.split('-').map(Number);
  
  wardData.forEach(household => {
    if (household.regionId === regionId && household.clusterId === clusterId) {
      highlightHousehold(household.id, highlight);
    }
  });
}

// Apply selection to assign households to cluster
function applyHouseholdSelection() {
  const selectedHouseholds = Array.from(regionManagementState.selectedItems)
    .map(id => wardData.find(h => h.id === id))
    .filter(h => h);
  
  if (selectedHouseholds.length === 0) {
    alert('No households selected');
    return;
  }
  
  const regionId = regionManagementState.currentRegion;
  const clusterId = regionManagementState.currentCluster;
  const regionName = regionStats[regionId]?.name || `Region ${regionId}`;
  
  // Update households
  selectedHouseholds.forEach(household => {
    // Record change
    changes.push({
      householdId: household.id,
      householdName: household.name,
      fromRegion: household.regionId,
      fromCluster: household.clusterId,
      fromRegionName: household.regionName,
      toRegion: regionId,
      toCluster: clusterId,
      toRegionName: regionName,
      timestamp: new Date().toISOString()
    });
    
    // Update household
    household.regionId = regionId;
    household.clusterId = clusterId;
    household.regionName = regionName;
    household.isIsolated = false;
    
    // Update marker
    if (window.updateMarkerAfterChange) {
      window.updateMarkerAfterChange(household);
    }
  });
  
  // Recalculate and update UI
  recalculateStatistics();
  if (window.updateBoundaries) window.updateBoundaries();
  if (window.showStatistics) window.showStatistics();
  if (window.showLegend) window.showLegend();
  if (window.updateChangesCounter) window.updateChangesCounter();
  if (window.buildHouseholdList) window.buildHouseholdList();
  saveDataLocally();
  
  // Clear selection
  cancelSelection();
  
  setStatus(`Assigned ${selectedHouseholds.length} households to ${regionName}, Cluster ${clusterId}`, 'success');
}

// Apply selection to assign clusters to region
function applyClusterSelection() {
  const selectedClusters = Array.from(regionManagementState.selectedItems);
  
  if (selectedClusters.length === 0) {
    alert('No clusters selected');
    return;
  }
  
  const targetRegionId = regionManagementState.currentRegion;
  const targetRegionName = regionStats[targetRegionId]?.name || `Region ${targetRegionId}`;
  
  let householdCount = 0;
  
  selectedClusters.forEach(clusterKey => {
    const [oldRegionId, oldClusterId] = clusterKey.split('-').map(Number);
    
    // Find households in this cluster
    const clusterHouseholds = wardData.filter(h => 
      h.regionId === oldRegionId && h.clusterId === oldClusterId
    );
    
    householdCount += clusterHouseholds.length;
    
    // Get new cluster ID in target region
    const newClusterId = getNextClusterId(targetRegionId);
    
    // Update households
    clusterHouseholds.forEach(household => {
      // Record change
      changes.push({
        householdId: household.id,
        householdName: household.name,
        fromRegion: household.regionId,
        fromCluster: household.clusterId,
        fromRegionName: household.regionName,
        toRegion: targetRegionId,
        toCluster: newClusterId,
        toRegionName: targetRegionName,
        timestamp: new Date().toISOString()
      });
      
      // Update household
      household.regionId = targetRegionId;
      household.clusterId = newClusterId;
      household.regionName = targetRegionName;
      
      // Update marker
      if (window.updateMarkerAfterChange) {
        window.updateMarkerAfterChange(household);
      }
    });
  });
  
  // Recalculate and update UI
  recalculateStatistics();
  if (window.updateBoundaries) window.updateBoundaries();
  if (window.showStatistics) window.showStatistics();
  if (window.showLegend) window.showLegend();
  if (window.updateChangesCounter) window.updateChangesCounter();
  if (window.buildHouseholdList) window.buildHouseholdList();
  saveDataLocally();
  
  // Clear selection
  cancelSelection();
  
  setStatus(`Reassigned ${selectedClusters.length} clusters (${householdCount} households) to ${targetRegionName}`, 'success');
}

// Cancel selection mode
function cancelSelection() {
  // Clear selected items
  regionManagementState.selectedItems.forEach(itemId => {
    if (regionManagementState.mode === 'select-households') {
      highlightHousehold(itemId, false);
    } else if (regionManagementState.mode === 'select-clusters') {
      highlightCluster(itemId, false);
    }
  });
  
  // Reset state
  regionManagementState.mode = null;
  regionManagementState.selectedItems.clear();
  regionManagementState.currentRegion = null;
  regionManagementState.currentCluster = null;
  
  // Disable selection tools
  disableMapSelection();
  
  // Hide selection UI
  hideSelectionInstructions();
}

// Show selection instructions
function showSelectionInstructions(type) {
  // Remove existing instruction panel if any
  const existingPanel = document.getElementById('selectionInstructions');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  const panel = document.createElement('div');
  panel.id = 'selectionInstructions';
  panel.className = 'selection-instructions';
  panel.innerHTML = `
    <div class="selection-header">
      <h4>Select ${type === 'household' ? 'Households' : 'Clusters'}</h4>
      <button class="close-btn" onclick="cancelSelection()">✕</button>
    </div>
    <div class="selection-body">
      <p>${type === 'household' ? 
        'Click households or drag to select multiple households to assign to the cluster.' :
        'Click clusters or drag to select multiple clusters to reassign to the region.'}</p>
      <div class="selection-status" id="selectionStatus">0 ${type === 'household' ? 'households' : 'clusters'} selected</div>
    </div>
    <div class="selection-footer">
      <button class="btn btn-secondary" onclick="cancelSelection()">Cancel</button>
      <button class="btn btn-primary" onclick="${type === 'household' ? 'applyHouseholdSelection()' : 'applyClusterSelection()'}">
        Apply Selection
      </button>
    </div>
  `;
  
  document.body.appendChild(panel);
}

// Hide selection instructions
function hideSelectionInstructions() {
  const panel = document.getElementById('selectionInstructions');
  if (panel) {
    panel.remove();
  }
}

// Update selection status
function updateSelectionStatus() {
  const statusEl = document.getElementById('selectionStatus');
  if (statusEl) {
    const count = regionManagementState.selectedItems.size;
    const type = regionManagementState.mode === 'select-households' ? 'households' : 'clusters';
    statusEl.textContent = `${count} ${type} selected`;
  }
}

// Show region/cluster management panel
function showRegionClusterPanel() {
  // Remove existing panel if any
  const existingPanel = document.getElementById('regionClusterPanel');
  if (existingPanel) {
    existingPanel.remove();
    return;
  }
  
  const panel = document.createElement('div');
  panel.id = 'regionClusterPanel';
  panel.className = 'region-cluster-panel';
  
  let panelHtml = `
    <div class="panel-header">
      <h3>Region & Cluster Management</h3>
      <button class="close-btn" onclick="document.getElementById('regionClusterPanel').remove()">✕</button>
    </div>
    <div class="panel-body">
  `;
  
  // Add region section
  panelHtml += `
    <div class="management-section">
      <h4>Regions</h4>
      <button class="btn btn-primary btn-sm" onclick="promptCreateRegion()">+ New Region</button>
      <div class="region-list">
  `;
  
  Object.entries(regionStats).forEach(([regionId, region]) => {
    const householdCount = wardData.filter(h => h.regionId === parseInt(regionId)).length;
    panelHtml += `
      <div class="region-item">
        <div class="region-info">
          <span class="region-color" style="background: ${region.color}"></span>
          <span class="region-name">${region.name}</span>
          <span class="region-count">${householdCount} households</span>
        </div>
        <div class="region-actions">
          <button class="btn-icon" onclick="promptRenameRegion(${regionId})" title="Rename">✏️</button>
          <button class="btn-icon" onclick="showRegionClusters(${regionId})" title="Manage Clusters">📁</button>
          <button class="btn-icon" onclick="startClusterSelection(${regionId})" title="Add Clusters">➕</button>
          <button class="btn-icon btn-danger" onclick="confirmDeleteRegion(${regionId})" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  });
  
  panelHtml += `
      </div>
    </div>
  `;
  
  // Add independent clusters section
  const independentClusters = {};
  Object.entries(clusterGroups).forEach(([key, cluster]) => {
    if (cluster.regionId === 0 || !cluster.regionId) {
      independentClusters[key] = cluster;
    }
  });
  
  if (Object.keys(independentClusters).length > 0) {
    panelHtml += `
      <div class="management-section">
        <h4>Independent Clusters</h4>
        <div class="cluster-list">
    `;
    
    Object.entries(independentClusters).forEach(([clusterKey, cluster]) => {
      const [, clusterId] = clusterKey.split('-').map(Number);
      const householdCount = wardData.filter(h => 
        h.regionId === 0 && h.clusterId === clusterId
      ).length;
      
      panelHtml += `
        <div class="cluster-item">
          <div class="cluster-info">
            <span class="cluster-name">Cluster ${clusterId}</span>
            <span class="cluster-count">${householdCount} households</span>
          </div>
          <div class="cluster-actions">
            <button class="btn-icon" onclick="assignClusterToRegion(0, ${clusterId})" title="Assign to Region">🔗</button>
            <button class="btn-icon" onclick="startHouseholdSelection(0, ${clusterId})" title="Add Households">➕</button>
            <button class="btn-icon" onclick="zoomToCluster(0, ${clusterId})" title="Zoom To">🔍</button>
            <button class="btn-icon btn-danger" onclick="confirmDeleteCluster(0, ${clusterId})" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    });
    
    panelHtml += `
        </div>
      </div>
    `;
  }
  
  // Add option to create independent cluster
  panelHtml += `
    <div class="management-section">
      <button class="btn btn-secondary btn-sm" onclick="createIndependentCluster()">+ New Independent Cluster</button>
    </div>
  `;
  
  panelHtml += `
    </div>
  `;
  
  panel.innerHTML = panelHtml;
  document.body.appendChild(panel);
}

// Show clusters for a specific region
function showRegionClusters(regionId) {
  const region = regionStats[regionId];
  if (!region) return;
  
  // Remove existing panel if any
  const existingPanel = document.getElementById('clusterManagementPanel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  const panel = document.createElement('div');
  panel.id = 'clusterManagementPanel';
  panel.className = 'cluster-management-panel';
  
  let panelHtml = `
    <div class="panel-header">
      <h3>Clusters in ${region.name}</h3>
      <button class="close-btn" onclick="document.getElementById('clusterManagementPanel').remove()">✕</button>
    </div>
    <div class="panel-body">
      <button class="btn btn-primary btn-sm" onclick="promptCreateCluster(${regionId}, '${region.name}')">+ New Cluster</button>
      <div class="cluster-list">
  `;
  
  Array.from(region.clusters).sort((a, b) => a - b).forEach(clusterId => {
    const householdCount = wardData.filter(h => 
      h.regionId === parseInt(regionId) && h.clusterId === clusterId
    ).length;
    
    panelHtml += `
      <div class="cluster-item">
        <div class="cluster-info">
          <span class="cluster-name">Cluster ${clusterId}</span>
          <span class="cluster-count">${householdCount} households</span>
        </div>
        <div class="cluster-actions">
          <button class="btn-icon" onclick="startHouseholdSelection(${regionId}, ${clusterId})" title="Add Households">➕</button>
          <button class="btn-icon" onclick="zoomToCluster(${regionId}, ${clusterId})" title="Zoom To">🔍</button>
          <button class="btn-icon btn-danger" onclick="confirmDeleteCluster(${regionId}, ${clusterId})" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  });
  
  panelHtml += `
      </div>
    </div>
  `;
  
  panel.innerHTML = panelHtml;
  document.body.appendChild(panel);
}

// Prompt to create new region
function promptCreateRegion() {
  const name = prompt('Enter name for new region:');
  if (name) {
    const region = createNewRegion(name);
    showStatistics();
    showLegend();
    showRegionClusterPanel(); // Refresh panel
    setStatus(`Created new region: ${region.name}`, 'success');
  }
}

// Prompt to rename region
function promptRenameRegion(regionId) {
  const region = regionStats[regionId];
  if (!region) return;
  
  const newName = prompt('Enter new name for region:', region.name);
  if (newName && newName !== region.name) {
    region.name = newName;
    
    // Update all households in this region
    wardData.forEach(household => {
      if (household.regionId === parseInt(regionId)) {
        household.regionName = newName;
      }
    });
    
    saveDataLocally();
    showStatistics();
    showLegend();
    buildHouseholdList();
    showRegionClusterPanel(); // Refresh panel
    setStatus(`Renamed region to: ${newName}`, 'success');
  }
}

// Prompt to create new cluster
function promptCreateCluster(regionId, regionName) {
  const cluster = createNewCluster(regionId, regionName);
  
  // Start household selection for the new cluster
  startHouseholdSelection(regionId, cluster.clusterId);
  
  // Close cluster panel
  const panel = document.getElementById('clusterManagementPanel');
  if (panel) panel.remove();
  
  setStatus(`Created Cluster ${cluster.clusterId} in ${regionName}. Select households to assign.`, 'info');
}

// Confirm region deletion
function confirmDeleteRegion(regionId) {
  const region = regionStats[regionId];
  if (!region) return;
  
  const householdCount = wardData.filter(h => h.regionId === parseInt(regionId)).length;
  
  if (confirm(`Delete "${region.name}"?`)) {
    if (deleteRegion(parseInt(regionId))) {
      recalculateStatistics();
      updateBoundaries();
      showStatistics();
      showLegend();
      updateChangesCounter();
      buildHouseholdList();
      saveDataLocally();
      showRegionClusterPanel(); // Refresh panel
      
      // Update all markers
      wardData.forEach(household => {
        if (window.updateMarkerAfterChange) {
          window.updateMarkerAfterChange(household);
        }
      });
      
      setStatus(`Deleted region: ${region.name}`, 'success');
    }
  }
}

// Confirm cluster deletion
function confirmDeleteCluster(regionId, clusterId) {
  const householdCount = wardData.filter(h => 
    h.regionId === parseInt(regionId) && h.clusterId === clusterId
  ).length;
  
  if (confirm(`Delete Cluster ${clusterId} with ${householdCount} households?`)) {
    if (deleteCluster(parseInt(regionId), clusterId)) {
      recalculateStatistics();
      updateBoundaries();
      showStatistics();
      showLegend();
      updateChangesCounter();
      buildHouseholdList();
      saveDataLocally();
      showRegionClusters(regionId); // Refresh clusters panel
      
      setStatus(`Deleted Cluster ${clusterId}`, 'success');
    }
  }
}

// Zoom to cluster on map
function zoomToCluster(regionId, clusterId) {
  const clusterHouseholds = wardData.filter(h => 
    h.regionId === parseInt(regionId) && h.clusterId === clusterId
  );
  
  if (clusterHouseholds.length > 0) {
    const bounds = clusterHouseholds.map(h => [h.lat, h.lon]);
    if (window.map) {
      window.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}

// Create independent cluster (not associated with any region)
function createIndependentCluster() {
  // Get next available cluster ID across all clusters
  const allClusterIds = wardData
    .filter(h => h.clusterId > 0)
    .map(h => h.clusterId);
  const clusterId = allClusterIds.length > 0 ? Math.max(...allClusterIds) + 1 : 1;
  
  const clusterKey = `0-${clusterId}`;
  
  // Add to clusterGroups as independent
  if (!clusterGroups[clusterKey]) {
    clusterGroups[clusterKey] = {
      regionId: 0, // 0 means independent
      clusterId: clusterId,
      color: '#6c757d', // Gray color for independent clusters
      bounds: []
    };
  }
  
  // Start household selection for the new cluster
  startHouseholdSelection(0, clusterId);
  
  // Refresh panel
  showRegionClusterPanel();
  
  setStatus(`Created independent Cluster ${clusterId}. Select households to assign.`, 'info');
}

// Assign an independent cluster to a region
function assignClusterToRegion(currentRegionId, clusterId) {
  const regions = Object.entries(regionStats);
  
  if (regions.length === 0) {
    alert('No regions available. Create a region first.');
    return;
  }
  
  // Create a simple selection dialog
  let message = 'Select target region for Cluster ' + clusterId + ':\n\n';
  regions.forEach(([id, region], index) => {
    message += `${index + 1}. ${region.name}\n`;
  });
  
  const choice = prompt(message + '\nEnter region number:');
  if (!choice) return;
  
  const selectedIndex = parseInt(choice) - 1;
  if (selectedIndex < 0 || selectedIndex >= regions.length) {
    alert('Invalid selection');
    return;
  }
  
  const targetRegionId = parseInt(regions[selectedIndex][0]);
  const targetRegionName = regions[selectedIndex][1].name;
  
  // Update all households in this cluster
  const affectedHouseholds = wardData.filter(h => 
    h.regionId === currentRegionId && h.clusterId === clusterId
  );
  
  affectedHouseholds.forEach(household => {
    // Record change
    changes.push({
      householdId: household.id,
      householdName: household.name,
      fromRegion: household.regionId,
      fromCluster: household.clusterId,
      fromRegionName: household.regionName,
      toRegion: targetRegionId,
      toCluster: clusterId,
      toRegionName: targetRegionName,
      timestamp: new Date().toISOString()
    });
    
    // Update household
    household.regionId = targetRegionId;
    household.regionName = targetRegionName;
    
    // Update marker
    if (window.updateMarkerAfterChange) {
      window.updateMarkerAfterChange(household);
    }
  });
  
  // Update clusterGroups
  const oldKey = `${currentRegionId}-${clusterId}`;
  const newKey = `${targetRegionId}-${clusterId}`;
  
  if (clusterGroups[oldKey]) {
    clusterGroups[newKey] = {
      ...clusterGroups[oldKey],
      regionId: targetRegionId,
      color: regionStats[targetRegionId].color
    };
    delete clusterGroups[oldKey];
  }
  
  // Update regionStats
  if (regionStats[targetRegionId]) {
    regionStats[targetRegionId].clusters.add(clusterId);
  }
  
  // Recalculate and update UI
  recalculateStatistics();
  if (window.updateBoundaries) window.updateBoundaries();
  if (window.showStatistics) window.showStatistics();
  if (window.showLegend) window.showLegend();
  if (window.updateChangesCounter) window.updateChangesCounter();
  if (window.buildHouseholdList) window.buildHouseholdList();
  saveDataLocally();
  
  // Refresh panel
  showRegionClusterPanel();
  
  setStatus(`Assigned Cluster ${clusterId} to ${targetRegionName}`, 'success');
}

// Export functions to global scope
window.regionManagementState = regionManagementState;
window.showRegionClusterPanel = showRegionClusterPanel;
window.showRegionClusters = showRegionClusters;
window.promptCreateRegion = promptCreateRegion;
window.promptRenameRegion = promptRenameRegion;
window.promptCreateCluster = promptCreateCluster;
window.confirmDeleteRegion = confirmDeleteRegion;
window.confirmDeleteCluster = confirmDeleteCluster;
window.startHouseholdSelection = startHouseholdSelection;
window.startClusterSelection = startClusterSelection;
window.applyHouseholdSelection = applyHouseholdSelection;
window.applyClusterSelection = applyClusterSelection;
window.cancelSelection = cancelSelection;
window.zoomToCluster = zoomToCluster;
window.createIndependentCluster = createIndependentCluster;
window.assignClusterToRegion = assignClusterToRegion;