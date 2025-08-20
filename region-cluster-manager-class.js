// region-cluster-manager-class.js - Object-oriented region and cluster management

class RegionClusterManager {
  constructor(stateManager, statusManager, uiManager, dataLayer, householdList, mapManager) {
    this.state = stateManager;
    this.status = statusManager;
    this.uiManager = uiManager;
    this.dataLayer = dataLayer;
    this.householdList = householdList;
    this.mapManager = mapManager;
    
    // Management state
    this.mode = null; // null, 'create-region', 'create-cluster', 'select-households', 'select-clusters'
    this.selectedItems = new Set();
    this.currentRegion = null;
    this.currentCluster = null;
    this.selectionRectangle = null;
    this.isDrawing = false;
    this.startPoint = null;
    
    // Color palette for regions
    this.colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
    ];
    
    this.init();
  }
  
  init() {
    // Initialize any event listeners or setup needed
    this.setupMapClickHandlers();
  }
  
  // Region management methods
  getNextRegionId() {
    const households = this.state.getAllHouseholds();
    const existingIds = households
      .filter(h => !h.isIsolated() && h.regionId > 0)
      .map(h => h.regionId);
    return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  }
  
  getNextClusterId(regionId) {
    const households = this.state.getAllHouseholds();
    const existingIds = households
      .filter(h => h.regionId === regionId)
      .map(h => h.communicationsClusterId);
    return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  }
  
  createNewRegion(name) {
    const regionId = this.getNextRegionId();
    const communicationsRegionName = name || `Region ${regionId}`;
    
    // Add to regionStats via StateManager
    const regionStats = this.state.getRegionStats();
    if (!regionStats.has(communicationsRegionName)) {
      this.state.setRegionStats(communicationsRegionName, {
        name: communicationsRegionName,
        count: 0,
        color: this.colors[(regionId - 1) % this.colors.length],
        bounds: [],
        clusters: new Set()
      });
    }
    
    return { id: regionId, name: communicationsRegionName };
  }
  
  createNewCluster(regionId, communicationsRegionName) {
    const communicationsClusterId = this.getNextClusterId(regionId);
    
    // Add to clusterGroups via StateManager
    const clusterKey = `${communicationsRegionName}-${communicationsClusterId}`;
    const regionStats = this.state.getRegionStats().get(communicationsRegionName);
    
    this.state.setClusterGroup(clusterKey, {
      communicationsRegionName,
      communicationsClusterId,
      color: regionStats ? regionStats.color : this.colors[0],
      bounds: []
    });
    
    return { id: communicationsClusterId, name: `Cluster ${communicationsClusterId}` };
  }
  
  // Mode management
  setMode(newMode) {
    this.mode = newMode;
    this.clearSelections();
    this.updateUIForMode();
  }
  
  clearMode() {
    this.mode = null;
    this.clearSelections();
    this.updateUIForMode();
  }
  
  clearSelections() {
    this.selectedItems.clear();
    this.currentRegion = null;
    this.currentCluster = null;
    this.clearSelectionRectangle();
  }
  
  // Selection rectangle management
  createSelectionRectangle(startPoint) {
    this.startPoint = startPoint;
    this.isDrawing = true;
    
    if (this.selectionRectangle) {
      this.clearSelectionRectangle();
    }
    
    this.selectionRectangle = L.rectangle([startPoint, startPoint], {
      color: '#007bff',
      weight: 2,
      fill: false,
      dashArray: '5,5'
    }).addTo(this.mapManager.map);
  }
  
  updateSelectionRectangle(currentPoint) {
    if (this.selectionRectangle && this.startPoint) {
      const bounds = [this.startPoint, currentPoint];
      this.selectionRectangle.setBounds(bounds);
    }
  }
  
  clearSelectionRectangle() {
    if (this.selectionRectangle) {
      this.mapManager.map.removeLayer(this.selectionRectangle);
      this.selectionRectangle = null;
    }
    this.isDrawing = false;
    this.startPoint = null;
  }
  
  // Household selection and assignment
  selectHouseholdsInRectangle(bounds) {
    const households = this.state.getAllHouseholds();
    const selected = [];
    
    households.forEach(household => {
      const point = [household.lat, household.lon];
      if (this.isPointInBounds(point, bounds)) {
        selected.push(household);
        this.selectedItems.add(household.id);
      }
    });
    
    return selected;
  }
  
  isPointInBounds(point, bounds) {
    const [lat, lon] = point;
    const [[minLat, minLon], [maxLat, maxLon]] = bounds;
    return lat >= Math.min(minLat, maxLat) && lat <= Math.max(minLat, maxLat) &&
           lon >= Math.min(minLon, maxLon) && lon <= Math.max(minLon, maxLon);
  }
  
  assignHouseholdsToCluster(householdIds, communicationsRegionName, communicationsClusterId) {
    let assignedCount = 0;
    
    householdIds.forEach(householdId => {
      const household = this.state.getHousehold(householdId);
      if (household) {
        this.state.updateHousehold(householdId, {
          communicationsRegionName,
          communicationsClusterId
        });
        assignedCount++;
      }
    });
    
    // Update UI and save
    if (assignedCount > 0) {
      this.uiManager.showStatistics();
      this.uiManager.showLegend();
      this.state.notify('ui:changes:updated');
      this.householdList.rebuild();
      this.dataLayer.saveToLocalStorage();
    }
    
    return assignedCount;
  }
  
  // UI update methods
  updateUIForMode() {
    const panel = document.getElementById('regionClusterPanel');
    if (!panel) return;
    
    // Update panel buttons and instructions based on current mode
    this.updatePanelInstructions();
    this.updatePanelButtons();
  }
  
  updatePanelInstructions() {
    const instructions = document.getElementById('panelInstructions');
    if (!instructions) return;
    
    switch (this.mode) {
      case 'create-region':
        instructions.textContent = 'Click and drag on the map to select households for the new region';
        break;
      case 'create-cluster':
        instructions.textContent = 'Click and drag on the map to select households for the new cluster';
        break;
      case 'select-households':
        instructions.textContent = 'Select households to assign to a cluster';
        break;
      case 'select-clusters':
        instructions.textContent = 'Select clusters to reassign to a different region';
        break;
      default:
        instructions.textContent = 'Choose an action from the buttons above';
    }
  }
  
  updatePanelButtons() {
    // Update button states based on current mode and selections
    const buttons = document.querySelectorAll('#regionClusterPanel button');
    buttons.forEach(button => {
      button.classList.remove('active');
    });
    
    if (this.mode) {
      const activeButton = document.querySelector(`[data-mode="${this.mode}"]`);
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }
  }
  
  // Map interaction setup
  setupMapClickHandlers() {
    if (!this.mapManager?.map) return;
    
    // Add map click handler for selection modes
    this.mapManager.map.on('mousedown', (e) => this.handleMapMouseDown(e));
    this.mapManager.map.on('mousemove', (e) => this.handleMapMouseMove(e));
    this.mapManager.map.on('mouseup', (e) => this.handleMapMouseUp(e));
  }
  
  handleMapMouseDown(e) {
    if (this.mode === 'create-region' || this.mode === 'create-cluster' || this.mode === 'select-households') {
      this.createSelectionRectangle([e.latlng.lat, e.latlng.lng]);
    }
  }
  
  handleMapMouseMove(e) {
    if (this.isDrawing) {
      this.updateSelectionRectangle([e.latlng.lat, e.latlng.lng]);
    }
  }
  
  handleMapMouseUp(e) {
    if (this.isDrawing) {
      const bounds = [[this.startPoint[0], this.startPoint[1]], [e.latlng.lat, e.latlng.lng]];
      const selected = this.selectHouseholdsInRectangle(bounds);
      
      this.clearSelectionRectangle();
      
      if (selected.length > 0) {
        this.handleHouseholdSelection(selected);
      }
    }
  }
  
  handleHouseholdSelection(selectedHouseholds) {
    this.status.info(`Selected ${selectedHouseholds.length} households`);
    
    switch (this.mode) {
      case 'create-region':
        this.promptForRegionCreation(selectedHouseholds);
        break;
      case 'create-cluster':
        this.promptForClusterCreation(selectedHouseholds);
        break;
      case 'select-households':
        this.showHouseholdAssignmentDialog(selectedHouseholds);
        break;
    }
  }
  
  promptForRegionCreation(households) {
    const name = prompt('Enter region name (or leave empty for auto-generated):');
    if (name === null) return; // User cancelled
    
    const region = this.createNewRegion(name);
    const assignedCount = this.assignHouseholdsToCluster(
      households.map(h => h.id), 
      region.name, 
      1 // Default cluster
    );
    
    this.status.success(`Created region "${region.name}" with ${assignedCount} households`);
    this.clearMode();
  }
  
  promptForClusterCreation(households) {
    if (!this.currentRegion) {
      this.status.error('No region selected for cluster creation');
      return;
    }
    
    const cluster = this.createNewCluster(this.currentRegion.id, this.currentRegion.name);
    const assignedCount = this.assignHouseholdsToCluster(
      households.map(h => h.id),
      this.currentRegion.name,
      cluster.id
    );
    
    this.status.success(`Created ${cluster.name} with ${assignedCount} households`);
    this.clearMode();
  }
  
  showHouseholdAssignmentDialog(households) {
    // Show dialog for household assignment
    // This would integrate with existing dialog system
    this.status.info(`Ready to assign ${households.length} selected households`);
  }
  
  // Region/cluster deletion methods
  deleteRegion(regionId) {
    const regionStats = this.state.getRegionStats();
    const households = this.state.getAllHouseholds();
    const affectedHouseholds = households.filter(h => h.regionId === regionId);
    const regionStat = regionStats.get(regionId.toString());
    const communicationsRegionName = regionStat?.name || `Region ${regionId}`;
    
    if (affectedHouseholds.length > 0) {
      affectedHouseholds.forEach(household => {
        // Record change
        this.state.addChange({
          householdId: household.id,
          householdName: household.name,
          fromRegion: household.regionId,
          fromCluster: household.communicationsClusterId,
          fromRegionName: household.communicationsRegionName,
          toRegion: 0,
          toCluster: household.communicationsClusterId,
          toRegionName: '',
          timestamp: new Date().toISOString()
        });
        
        // Update household - keep cluster but remove region
        this.state.updateHousehold(household.id, {
          regionId: 0,
          communicationsRegionName: ''
        });
      });
      
      // Update clusterGroups to mark clusters as region-less
      const clusterGroups = this.state.getClusterGroups();
      clusterGroups.forEach((cluster, key) => {
        if (cluster.regionId === regionId) {
          this.state.setClusterGroup(key, { ...cluster, regionId: 0 });
        }
      });
    }
    
    // Remove from regionStats
    this.state.deleteRegionStats(regionId.toString());
    
    // Update UI components
    this.updateUIAfterChange(affectedHouseholds);
    
    return true;
  }
  
  deleteCluster(regionId, communicationsClusterId) {
    const households = this.state.getAllHouseholds();
    const affectedHouseholds = households.filter(h => 
      h.regionId === regionId && h.communicationsClusterId === communicationsClusterId
    );
    
    if (affectedHouseholds.length > 0) {
      affectedHouseholds.forEach(household => {
        // Record change
        this.state.addChange({
          householdId: household.id,
          householdName: household.name,
          fromRegion: household.regionId,
          fromCluster: household.communicationsClusterId,
          fromRegionName: household.communicationsRegionName,
          toRegion: household.regionId,
          toCluster: 0,
          toRegionName: household.communicationsRegionName,
          timestamp: new Date().toISOString()
        });
        
        // Remove cluster but keep region
        this.state.updateHousehold(household.id, {
          communicationsClusterId: 0
        });
      });
    }
    
    // Remove from regionStats
    const regionStats = this.state.getRegionStats();
    const regionStat = regionStats.get(regionId.toString());
    if (regionStat && regionStat.clusters) {
      regionStat.clusters.delete(communicationsClusterId);
      this.state.setRegionStats(regionId.toString(), regionStat);
    }
    
    // Remove from clusterGroups
    const clusterKey = `${regionId}-${communicationsClusterId}`;
    this.state.deleteClusterGroup(clusterKey);
    
    this.updateUIAfterChange(affectedHouseholds);
    
    return true;
  }
  
  // Selection mode management
  startHouseholdSelection(targetRegionId, targetClusterId) {
    this.mode = 'select-households';
    this.currentRegion = { id: targetRegionId };
    this.currentCluster = { id: targetClusterId };
    this.selectedItems.clear();
    
    this.showSelectionInstructions('household');
    this.enableMapSelection();
  }
  
  startClusterSelection(targetRegionId) {
    this.mode = 'select-clusters';
    this.currentRegion = { id: targetRegionId };
    this.selectedItems.clear();
    
    this.showSelectionInstructions('cluster');
    this.enableMapSelection();
  }
  
  enableMapSelection() {
    if (!this.mapManager?.map) return;
    
    // Change cursor
    this.mapManager.map.getContainer().style.cursor = 'crosshair';
    
    // Disable map dragging temporarily
    this.mapManager.map.dragging.disable();
    
    // Add click selection for individual items
    this.mapManager.map.on('click', (e) => this.handleMapClick(e));
  }
  
  disableMapSelection() {
    if (!this.mapManager?.map) return;
    
    // Reset cursor
    this.mapManager.map.getContainer().style.cursor = '';
    
    // Re-enable map dragging
    this.mapManager.map.dragging.enable();
    
    // Remove selection handlers
    this.mapManager.map.off('click');
    
    // Clear selection rectangle if exists
    this.clearSelectionRectangle();
  }
  
  handleMapClick(e) {
    if (this.isDrawing) return;
    
    // Find closest household
    const households = this.state.getAllHouseholds();
    let closestHousehold = null;
    let minDistance = Infinity;
    
    households.forEach(household => {
      const distance = this.mapManager.map.distance(e.latlng, [household.lat, household.lon]);
      if (distance < minDistance && distance < 20) { // Within 20 meters
        minDistance = distance;
        closestHousehold = household;
      }
    });
    
    if (closestHousehold) {
      if (this.mode === 'select-households') {
        this.toggleHouseholdSelection(closestHousehold);
      } else if (this.mode === 'select-clusters' && !closestHousehold.isIsolated()) {
        this.toggleClusterSelection(closestHousehold.regionId, closestHousehold.communicationsClusterId);
      }
    }
  }
  
  toggleHouseholdSelection(household) {
    if (this.selectedItems.has(household.id)) {
      this.selectedItems.delete(household.id);
      this.highlightHousehold(household.id, false);
    } else {
      this.selectedItems.add(household.id);
      this.highlightHousehold(household.id, true);
    }
    
    this.updateSelectionStatus();
  }
  
  toggleClusterSelection(regionId, communicationsClusterId) {
    const clusterKey = `${regionId}-${communicationsClusterId}`;
    
    if (this.selectedItems.has(clusterKey)) {
      this.selectedItems.delete(clusterKey);
      this.highlightCluster(clusterKey, false);
    } else {
      this.selectedItems.add(clusterKey);
      this.highlightCluster(clusterKey, true);
    }
    
    this.updateSelectionStatus();
  }
  
  highlightHousehold(householdId, highlight) {
    const markers = this.state.getMarkers();
    const marker = markers.get(householdId);
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
        const household = this.state.getHousehold(householdId);
        const regionStats = this.state.getRegionStats();
        const color = household.isIsolated() ? '#6c757d' : 
                     regionStats.get(household.regionId?.toString())?.color || '#007bff';
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
  
  highlightCluster(clusterKey, highlight) {
    const [regionId, communicationsClusterId] = clusterKey.split('-').map(Number);
    const households = this.state.getAllHouseholds();
    
    households.forEach(household => {
      if (household.regionId === regionId && household.communicationsClusterId === communicationsClusterId) {
        this.highlightHousehold(household.id, highlight);
      }
    });
  }
  
  applyHouseholdSelection() {
    const households = this.state.getAllHouseholds();
    const selectedHouseholds = Array.from(this.selectedItems)
      .map(id => households.find(h => h.id === id))
      .filter(h => h);
    
    if (selectedHouseholds.length === 0) {
      alert('No households selected');
      return;
    }
    
    const regionId = this.currentRegion.id;
    const communicationsClusterId = this.currentCluster.id;
    const regionStats = this.state.getRegionStats();
    const communicationsRegionName = regionStats.get(regionId.toString())?.name || `Region ${regionId}`;
    
    const assignedCount = this.assignHouseholdsToCluster(
      selectedHouseholds.map(h => h.id),
      communicationsRegionName,
      communicationsClusterId
    );
    
    this.cancelSelection();
    
    this.status.success(`Assigned ${assignedCount} households to ${communicationsRegionName}, Cluster ${communicationsClusterId}`);
  }
  
  applyClusterSelection() {
    const selectedClusters = Array.from(this.selectedItems);
    
    if (selectedClusters.length === 0) {
      alert('No clusters selected');
      return;
    }
    
    const targetRegionId = this.currentRegion.id;
    const regionStats = this.state.getRegionStats();
    const targetRegionName = regionStats.get(targetRegionId.toString())?.name || `Region ${targetRegionId}`;
    
    let householdCount = 0;
    const households = this.state.getAllHouseholds();
    
    selectedClusters.forEach(clusterKey => {
      const [oldRegionId, oldClusterId] = clusterKey.split('-').map(Number);
      
      // Find households in this cluster
      const clusterHouseholds = households.filter(h => 
        h.regionId === oldRegionId && h.communicationsClusterId === oldClusterId
      );
      
      householdCount += clusterHouseholds.length;
      
      // Get new cluster ID in target region
      const newClusterId = this.getNextClusterId(targetRegionId);
      
      // Update households
      clusterHouseholds.forEach(household => {
        this.state.addChange({
          householdId: household.id,
          householdName: household.name,
          fromRegion: household.regionId,
          fromCluster: household.communicationsClusterId,
          fromRegionName: household.communicationsRegionName,
          toRegion: targetRegionId,
          toCluster: newClusterId,
          toRegionName: targetRegionName,
          timestamp: new Date().toISOString()
        });
        
        this.state.updateHousehold(household.id, {
          regionId: targetRegionId,
          communicationsClusterId: newClusterId,
          communicationsRegionName: targetRegionName
        });
      });
    });
    
    this.updateUIAfterChange(households.filter(h => 
      selectedClusters.some(key => {
        const [regionId, clusterId] = key.split('-').map(Number);
        return h.regionId === regionId && h.communicationsClusterId === clusterId;
      })
    ));
    
    this.cancelSelection();
    
    this.status.success(`Reassigned ${selectedClusters.length} clusters (${householdCount} households) to ${targetRegionName}`);
  }
  
  cancelSelection() {
    // Clear selected items
    this.selectedItems.forEach(itemId => {
      if (this.mode === 'select-households') {
        this.highlightHousehold(itemId, false);
      } else if (this.mode === 'select-clusters') {
        this.highlightCluster(itemId, false);
      }
    });
    
    // Reset state
    this.clearMode();
    
    // Disable selection tools
    this.disableMapSelection();
    
    // Hide selection UI
    this.hideSelectionInstructions();
  }
  
  showSelectionInstructions(type) {
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
        <button class="close-btn" data-action="cancel-selection">✕</button>
      </div>
      <div class="selection-body">
        <p>${type === 'household' ? 
          'Click households or drag to select multiple households to assign to the cluster.' :
          'Click clusters or drag to select multiple clusters to reassign to the region.'}</p>
        <div class="selection-status" id="selectionStatus">0 ${type === 'household' ? 'households' : 'clusters'} selected</div>
      </div>
      <div class="selection-footer">
        <button class="btn btn-secondary" data-action="cancel-selection">Cancel</button>
        <button class="btn btn-primary" data-action="apply-${type}-selection">
          Apply Selection
        </button>
      </div>
    `;
    
    document.body.appendChild(panel);
  }
  
  hideSelectionInstructions() {
    const panel = document.getElementById('selectionInstructions');
    if (panel) {
      panel.remove();
    }
  }
  
  updateSelectionStatus() {
    const statusEl = document.getElementById('selectionStatus');
    if (statusEl) {
      const count = this.selectedItems.size;
      const type = this.mode === 'select-households' ? 'households' : 'clusters';
      statusEl.textContent = `${count} ${type} selected`;
    }
  }
  
  updateUIAfterChange(affectedHouseholds) {
    // Update all markers
    affectedHouseholds.forEach(household => {
      this.mapManager.updateMarkerAfterChange(household);
    });
    
    // Rebuild boundaries
    this.mapManager.updateBoundaries();
    
    // Update other UI components
    this.uiManager.showStatistics();
    this.uiManager.showLegend();
    this.state.notify('ui:changes:updated');
    this.householdList.rebuild();
    this.dataLayer.saveToLocalStorage();
  }
  
  // Public API methods that replace global functions
  showRegionClusterPanel() {
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
        <button class="close-btn" data-action="close-region-panel">✕</button>
      </div>
      <div class="panel-body">
    `;
    
    // Add region section
    panelHtml += this.buildRegionSection();
    
    // Add independent clusters section
    panelHtml += this.buildIndependentClustersSection();
    
    // Add option to create independent cluster
    panelHtml += `
      <div class="management-section">
        <button class="btn btn-secondary btn-sm" data-action="create-independent-cluster">+ New Independent Cluster</button>
      </div>
    `;
    
    panelHtml += `</div>`;
    
    panel.innerHTML = panelHtml;
    document.body.appendChild(panel);
  }
  
  buildRegionSection() {
    const regionStats = this.state.getRegionStats();
    const households = this.state.getAllHouseholds();
    
    let html = `
      <div class="management-section">
        <h4>Regions</h4>
        <button class="btn btn-primary btn-sm" data-action="create-region">+ New Region</button>
        <div class="region-list">
    `;
    
    regionStats.forEach((region, regionId) => {
      const householdCount = households.filter(h => h.regionId === parseInt(regionId)).length;
      html += `
        <div class="region-item">
          <div class="region-info">
            <span class="region-color" style="background: ${region.color}"></span>
            <span class="region-name">${region.name}</span>
            <span class="region-count">${householdCount} households</span>
          </div>
          <div class="region-actions">
            <button class="btn-icon" data-action="rename-region" data-region-id="${regionId}" title="Rename">✏️</button>
            <button class="btn-icon" data-action="manage-clusters" data-region-id="${regionId}" title="Manage Clusters">📁</button>
            <button class="btn-icon" data-action="add-clusters" data-region-id="${regionId}" title="Add Clusters">➕</button>
            <button class="btn-icon btn-danger" data-action="delete-region" data-region-id="${regionId}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
  
  buildIndependentClustersSection() {
    const clusterGroups = this.state.getClusterGroups();
    const households = this.state.getAllHouseholds();
    const independentClusters = new Map();
    
    clusterGroups.forEach((cluster, key) => {
      if (cluster.regionId === 0 || !cluster.regionId) {
        independentClusters.set(key, cluster);
      }
    });
    
    if (independentClusters.size === 0) {
      return '';
    }
    
    let html = `
      <div class="management-section">
        <h4>Independent Clusters</h4>
        <div class="cluster-list">
    `;
    
    independentClusters.forEach((cluster, clusterKey) => {
      const [, communicationsClusterId] = clusterKey.split('-').map(Number);
      const householdCount = households.filter(h => 
        h.regionId === 0 && h.communicationsClusterId === communicationsClusterId
      ).length;
      
      html += `
        <div class="cluster-item">
          <div class="cluster-info">
            <span class="cluster-name">Cluster ${communicationsClusterId}</span>
            <span class="cluster-count">${householdCount} households</span>
          </div>
          <div class="cluster-actions">
            <button class="btn-icon" data-action="assign-cluster" data-region-id="0" data-cluster-id="${communicationsClusterId}" title="Assign to Region">🔗</button>
            <button class="btn-icon" data-action="add-households" data-region-id="0" data-cluster-id="${communicationsClusterId}" title="Add Households">➕</button>
            <button class="btn-icon" data-action="zoom-cluster" data-region-id="0" data-cluster-id="${communicationsClusterId}" title="Zoom To">🔍</button>
            <button class="btn-icon btn-danger" data-action="delete-cluster" data-region-id="0" data-cluster-id="${communicationsClusterId}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
  
  showRegionClusters(regionId) {
    const regionStats = this.state.getRegionStats();
    const region = regionStats.get(regionId.toString());
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
        <button class="close-btn" data-action="close-cluster-panel">✕</button>
      </div>
      <div class="panel-body">
        <button class="btn btn-primary btn-sm" data-action="create-cluster" data-region-id="${regionId}" data-region-name="${region.name}">+ New Cluster</button>
        <div class="cluster-list">
    `;
    
    const households = this.state.getAllHouseholds();
    if (region.clusters) {
      Array.from(region.clusters).sort((a, b) => a - b).forEach(communicationsClusterId => {
        const householdCount = households.filter(h => 
          h.regionId === parseInt(regionId) && h.communicationsClusterId === communicationsClusterId
        ).length;
        
        panelHtml += `
          <div class="cluster-item">
            <div class="cluster-info">
              <span class="cluster-name">Cluster ${communicationsClusterId}</span>
              <span class="cluster-count">${householdCount} households</span>
            </div>
            <div class="cluster-actions">
              <button class="btn-icon" data-action="add-households" data-region-id="${regionId}" data-cluster-id="${communicationsClusterId}" title="Add Households">➕</button>
              <button class="btn-icon" data-action="zoom-cluster" data-region-id="${regionId}" data-cluster-id="${communicationsClusterId}" title="Zoom To">🔍</button>
              <button class="btn-icon btn-danger" data-action="delete-cluster" data-region-id="${regionId}" data-cluster-id="${communicationsClusterId}" title="Delete">🗑️</button>
            </div>
          </div>
        `;
      });
    }
    
    panelHtml += `
        </div>
      </div>
    `;
    
    panel.innerHTML = panelHtml;
    document.body.appendChild(panel);
  }
  
  promptCreateRegion() {
    const name = prompt('Enter name for new region:');
    if (name) {
      const region = this.createNewRegion(name);
      this.uiManager.showStatistics();
      this.uiManager.showLegend();
      this.showRegionClusterPanel(); // Refresh panel
      this.status.success(`Created new region: ${region.name}`);
    }
  }
  
  promptRenameRegion(regionId) {
    const regionStats = this.state.getRegionStats();
    const region = regionStats.get(regionId.toString());
    if (!region) return;
    
    const newName = prompt('Enter new name for region:', region.name);
    if (newName && newName !== region.name) {
      // Update region stats
      this.state.setRegionStats(regionId.toString(), { ...region, name: newName });
      
      // Update all households in this region
      const households = this.state.getAllHouseholds();
      households.forEach(household => {
        if (household.regionId === parseInt(regionId)) {
          this.state.updateHousehold(household.id, {
            communicationsRegionName: newName
          });
        }
      });
      
      this.dataLayer.saveToLocalStorage();
      this.uiManager.showStatistics();
      this.uiManager.showLegend();
      this.householdList.rebuild();
      this.showRegionClusterPanel(); // Refresh panel
      this.status.success(`Renamed region to: ${newName}`);
    }
  }
  
  promptCreateCluster(regionId, communicationsRegionName) {
    const cluster = this.createNewCluster(regionId, communicationsRegionName);
    
    // Start household selection for the new cluster
    this.startHouseholdSelection(regionId, cluster.id);
    
    // Close cluster panel
    const panel = document.getElementById('clusterManagementPanel');
    if (panel) panel.remove();
    
    this.status.info(`Created Cluster ${cluster.id} in ${communicationsRegionName}. Select households to assign.`);
  }
  
  confirmDeleteRegion(regionId) {
    const regionStats = this.state.getRegionStats();
    const region = regionStats.get(regionId.toString());
    if (!region) return;
    
    const households = this.state.getAllHouseholds();
    const householdCount = households.filter(h => h.regionId === parseInt(regionId)).length;
    
    if (confirm(`Delete "${region.name}"? This will preserve clusters as independent clusters.`)) {
      if (this.deleteRegion(parseInt(regionId))) {
        this.showRegionClusterPanel(); // Refresh panel
        this.status.success(`Deleted region: ${region.name}`);
      }
    }
  }
  
  confirmDeleteCluster(regionId, communicationsClusterId) {
    const households = this.state.getAllHouseholds();
    const householdCount = households.filter(h => 
      h.regionId === parseInt(regionId) && h.communicationsClusterId === communicationsClusterId
    ).length;
    
    if (confirm(`Delete Cluster ${communicationsClusterId} with ${householdCount} households?`)) {
      if (this.deleteCluster(parseInt(regionId), communicationsClusterId)) {
        this.showRegionClusters(regionId); // Refresh clusters panel
        this.status.success(`Deleted Cluster ${communicationsClusterId}`);
      }
    }
  }
  
  zoomToCluster(regionId, communicationsClusterId) {
    const households = this.state.getAllHouseholds();
    const clusterHouseholds = households.filter(h => 
      h.regionId === parseInt(regionId) && h.communicationsClusterId === communicationsClusterId
    );
    
    if (clusterHouseholds.length > 0) {
      const bounds = clusterHouseholds.map(h => [h.lat, h.lon]);
      if (this.mapManager?.map) {
        this.mapManager.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }
  
  createIndependentCluster() {
    // Get next available cluster ID across all clusters
    const households = this.state.getAllHouseholds();
    const allClusterIds = households
      .filter(h => h.communicationsClusterId > 0)
      .map(h => h.communicationsClusterId);
    const communicationsClusterId = allClusterIds.length > 0 ? Math.max(...allClusterIds) + 1 : 1;
    
    const clusterKey = `0-${communicationsClusterId}`;
    
    // Add to clusterGroups as independent
    this.state.setClusterGroup(clusterKey, {
      regionId: 0, // 0 means independent
      communicationsClusterId: communicationsClusterId,
      color: '#6c757d', // Gray color for independent clusters
      bounds: []
    });
    
    // Start household selection for the new cluster
    this.startHouseholdSelection(0, communicationsClusterId);
    
    // Refresh panel
    this.showRegionClusterPanel();
    
    this.status.info(`Created independent Cluster ${communicationsClusterId}. Select households to assign.`);
  }
  
  assignClusterToRegion(currentRegionId, communicationsClusterId) {
    const regionStats = this.state.getRegionStats();
    const regions = Array.from(regionStats.entries());
    
    if (regions.length === 0) {
      alert('No regions available. Create a region first.');
      return;
    }
    
    // Create a simple selection dialog
    let message = 'Select target region for Cluster ' + communicationsClusterId + ':\n\n';
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
    const households = this.state.getAllHouseholds();
    const affectedHouseholds = households.filter(h => 
      h.regionId === currentRegionId && h.communicationsClusterId === communicationsClusterId
    );
    
    affectedHouseholds.forEach(household => {
      this.state.addChange({
        householdId: household.id,
        householdName: household.name,
        fromRegion: household.regionId,
        fromCluster: household.communicationsClusterId,
        fromRegionName: household.communicationsRegionName,
        toRegion: targetRegionId,
        toCluster: communicationsClusterId,
        toRegionName: targetRegionName,
        timestamp: new Date().toISOString()
      });
      
      this.state.updateHousehold(household.id, {
        regionId: targetRegionId,
        communicationsRegionName: targetRegionName
      });
    });
    
    // Update clusterGroups
    const oldKey = `${currentRegionId}-${communicationsClusterId}`;
    const newKey = `${targetRegionId}-${communicationsClusterId}`;
    
    const oldCluster = this.state.getClusterGroups().get(oldKey);
    if (oldCluster) {
      this.state.setClusterGroup(newKey, {
        ...oldCluster,
        regionId: targetRegionId,
        color: regionStats.get(targetRegionId.toString()).color
      });
      this.state.deleteClusterGroup(oldKey);
    }
    
    // Update regionStats
    const targetRegion = regionStats.get(targetRegionId.toString());
    if (targetRegion) {
      if (!targetRegion.clusters) {
        targetRegion.clusters = new Set();
      }
      targetRegion.clusters.add(communicationsClusterId);
      this.state.setRegionStats(targetRegionId.toString(), targetRegion);
    }
    
    this.updateUIAfterChange(affectedHouseholds);
    
    // Refresh panel
    this.showRegionClusterPanel();
    
    this.status.success(`Assigned Cluster ${communicationsClusterId} to ${targetRegionName}`);
  }
  
  hideRegionClusterPanel() {
    this.clearMode();
  }
  
  // Cleanup
  destroy() {
    this.clearSelections();
    if (this.mapManager?.map) {
      this.mapManager.map.off('mousedown');
      this.mapManager.map.off('mousemove'); 
      this.mapManager.map.off('mouseup');
    }
  }
}

// RegionClusterManager will be created by TileManager to ensure proper initialization order

