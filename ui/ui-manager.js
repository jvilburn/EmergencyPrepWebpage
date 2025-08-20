// ui/ui-manager.js - Coordination between UI modules

class UIManager {
  constructor(stateManager) {
    this.state = stateManager;
    this.modules = {};
    this.init();
  }
  
  init() {
    // Store references to UI modules
    this.modules = {
      sidebar: window.sidebar,
      householdList: window.householdList,
      resourceFilters: window.resourceFilters,
      highlighting: window.highlightingManager
    };
    
    // Set up inter-module coordination
    this.setupEventCoordination();
    
    // Initialize UI state
    this.initializeUIState();
  }
  
  setupEventCoordination() {
    // Coordinate between sidebar and household list
    this.state.subscribe('ui:sort:changed', (mode) => {
      this.modules.householdList.rebuild();
      this.updateSortButtons(mode);
    });
    
    // Coordinate between resource filters and other modules
    this.state.subscribe('ui:filters:applied', (filters) => {
      this.modules.sidebar.updateFooter();
    });
    
    this.state.subscribe('ui:filters:cleared', () => {
      this.modules.sidebar.updateFooter();
    });
    
    // Coordinate highlighting across modules
    this.state.subscribe('ui:highlight:changed', (items) => {
      this.updateHighlightStates(items);
    });
    
    this.state.subscribe('ui:highlight:cleared', () => {
      this.clearAllHighlights();
    });
    
    // Coordinate data changes across all modules
    this.state.subscribe('households:loaded', (households) => {
      this.onHouseholdsLoaded(households);
    });
    
    this.state.subscribe('household:updated', (data) => {
      this.onHouseholdUpdated(data);
    });
  }
  
  initializeUIState() {
    // Set initial sort mode
    this.updateSortButtons(this.state.getSortMode());
    
    // Set initial sidebar state
    if (this.state.isSidebarCollapsed()) {
      this.modules.sidebar.collapse();
    }
    
    // Initialize with empty state if no data
    if (this.state.getAllHouseholds().length === 0) {
      this.showEmptyState();
    }
  }
  
  updateSortButtons(activeMode) {
    const nameBtn = document.getElementById('nameBtn');
    const regionBtn = document.getElementById('regionBtn');
    
    if (nameBtn) {
      nameBtn.classList.toggle('active', activeMode === 'name');
    }
    
    if (regionBtn) {
      regionBtn.classList.toggle('active', activeMode === 'region');
    }
  }
  
  updateHighlightStates(items) {
    // Coordinate highlighting visual effects across modules
    if (items && items.length > 0) {
      // Enable highlight mode UI states
      this.enableHighlightMode();
    } else {
      // Disable highlight mode UI states
      this.disableHighlightMode();
    }
  }
  
  clearAllHighlights() {
    // Ensure all modules clear their highlights
    this.disableHighlightMode();
  }
  
  enableHighlightMode() {
    // Add visual indicators that highlighting is active
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.add('has-highlights');
    }
  }
  
  disableHighlightMode() {
    // Remove highlighting visual states
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('has-highlights');
    }
  }
  
  onHouseholdsLoaded(households) {
    // Coordinate response to data loading
    console.log(`UIManager: Loaded ${households.length} households`);
    
    // Refresh all modules
    this.refreshAllModules();
    
    // Clear any existing highlights (UI only during loading)
    this.modules.highlighting.clearHighlightsUI();
    
    // Update footer
    this.modules.sidebar.updateFooter();
    
    // Show loaded state
    this.showLoadedState();
  }
  
  onHouseholdUpdated(data) {
    // Coordinate response to household updates
    const { id, household } = data;
    
    // Update map marker if it exists
    const marker = this.state.getMapMarker(id);
    if (marker && window.updateMarkerAfterChange) {
      window.updateMarkerAfterChange(household);
    }
    
    // Refresh modules that depend on household data
    this.modules.resourceFilters.refresh();
    this.modules.sidebar.updateFooter();
  }
  
  refreshAllModules() {
    Object.values(this.modules).forEach(module => {
      if (module && typeof module.refresh === 'function') {
        module.refresh();
      }
    });
  }
  
  showEmptyState() {
    // Coordinate empty state across modules
    const status = document.getElementById('statusMessage');
    if (status) {
      status.textContent = 'Ready - Load CSV to begin';
    }
  }
  
  showLoadedState() {
    // Coordinate loaded state across modules
    const status = document.getElementById('statusMessage');
    const stats = this.state.getStats();
    
    if (status) {
      status.textContent = `Loaded ${stats.totalHouseholds} households in ${stats.totalRegions} regions`;
    }
  }
  
  // Public API for external coordination
  
  highlightHousehold(householdId) {
    this.modules.highlighting.highlightHousehold(householdId);
  }
  
  highlightRegion(regionId) {
    this.modules.highlighting.highlightRegion(regionId);
  }
  
  highlightCluster(regionId, communicationsClusterId) {
    this.modules.highlighting.highlightCluster(regionId, communicationsClusterId);
  }
  
  clearHighlights() {
    this.modules.highlighting.clearHighlights();
  }
  
  setSortMode(mode) {
    this.modules.sidebar.setSortMode(mode);
  }
  
  toggleSidebar() {
    this.modules.sidebar.toggle();
  }
  
  applyResourceFilters() {
    this.modules.resourceFilters.applyFilters();
  }
  
  clearResourceFilters() {
    this.modules.resourceFilters.clearFilters();
  }
  
  searchHouseholds(query) {
    this.modules.sidebar.handleSearch(query);
  }
  
  // Statistics and info
  getUIStats() {
    return {
      totalHouseholds: this.state.getAllHouseholds().length,
      visibleHouseholds: this.modules.householdList.getVisibleHouseholds().length,
      activeFilters: Object.keys(this.state.getActiveFilters()).length,
      highlightedItems: this.state.getHighlightedItems().length,
      sidebarCollapsed: this.state.isSidebarCollapsed(),
      sortMode: this.state.getSortMode()
    };
  }
  
  // Show statistics modal
  showStatistics() {
    const stats = this.state.getStats();
    const regionStats = this.state.getRegionStats();
    const clusterGroups = this.state.getClusterGroups();
    
    let statsHTML = `
      <h2>Ward Statistics</h2>
      <div style="font-size: 14px;">
        <p><strong>Total Households:</strong> ${stats.totalHouseholds}</p>
        <p><strong>Households in Regions:</strong> ${stats.householdsInRegions}</p>
        <p><strong>Isolated Households:</strong> ${stats.isolatedHouseholds}</p>
        <p><strong>Total Regions:</strong> ${regionStats.size}</p>
        <p><strong>Total Clusters:</strong> ${clusterGroups.size}</p>
        <hr>
    `;
    
    // Add region breakdown
    if (regionStats.size > 0) {
      statsHTML += '<h3>Regions:</h3><ul>';
      for (const [name, region] of regionStats) {
        statsHTML += `<li>${name}: ${region.count} households in ${region.clusters.size} clusters</li>`;
      }
      statsHTML += '</ul>';
    }
    
    statsHTML += '</div>';
    
    this.showModal('Statistics', statsHTML);
  }
  
  // Show legend modal
  showLegend() {
    const regionStats = this.state.getRegionStats();
    
    let legendHTML = `
      <h2>Map Legend</h2>
      <div style="font-size: 14px;">
        <h3>Region Colors:</h3>
        <ul style="list-style: none; padding: 0;">
    `;
    
    // Add region colors
    for (const [name, region] of regionStats) {
      legendHTML += `
        <li style="margin: 5px 0;">
          <span style="display: inline-block; width: 20px; height: 20px; 
                       background-color: ${region.color}; border: 1px solid #333; 
                       vertical-align: middle; margin-right: 10px;"></span>
          ${name}
        </li>
      `;
    }
    
    legendHTML += `
        </ul>
        <hr>
        <h3>Marker Icons:</h3>
        <ul>
          <li>🏠 Household in a cluster</li>
          <li>⚠️ Isolated household</li>
          <li>📍 Selected/highlighted household</li>
        </ul>
      </div>
    `;
    
    this.showModal('Legend', legendHTML);
  }
  
  // Generic modal display
  showModal(title, content) {
    // Remove existing modal if any
    const existingModal = document.getElementById('ui-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'ui-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08);
      z-index: 10000;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'ui-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
    `;
    closeBtn.onclick = () => {
      modal.remove();
      backdrop.remove();
    };
    
    // Assemble modal
    modal.innerHTML = content;
    modal.insertBefore(closeBtn, modal.firstChild);
    
    // Click backdrop to close
    backdrop.onclick = () => {
      modal.remove();
      backdrop.remove();
    };
    
    // Add to DOM
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }
  
  // Error handling
  handleError(error, context = '') {
    console.error(`UIManager Error ${context}:`, error);
    
    // Show user-friendly error message
    const status = document.getElementById('statusMessage');
    if (status) {
      status.textContent = `Error: ${error.message}`;
      status.style.color = '#e74c3c';
    }
    
    // Reset UI state on error
    this.modules.highlighting.clearHighlights();
  }
  
  // Cleanup
  destroy() {
    // Clean up event listeners and references
    Object.keys(this.modules).forEach(key => {
      delete this.modules[key];
    });
  }
}

// Create and export global instance (will be created after all modules are loaded)
