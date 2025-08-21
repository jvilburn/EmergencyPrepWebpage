// ui/household-list.js - Household list rendering and management

class HouseholdList {
  constructor(stateManager) {
    this.state = stateManager;
    this.container = null;
    this.init();
  }
  
  init() {
    this.container = document.getElementById('householdList');
    if (!this.container) {
      console.error('Household list container not found');
      return;
    }
    
    // Listen to state changes
    this.state.subscribe('households:loaded', (households) => {
      this.rebuild();
    });
    this.state.subscribe('household:added', () => this.rebuild());
    this.state.subscribe('household:updated', () => this.rebuild());
    this.state.subscribe('household:deleted', () => this.rebuild());
    this.state.subscribe('ui:sort:changed', () => this.rebuild());
    this.state.subscribe('ui:filters:changed', () => this.applyFilters());
    
    this.rebuild();
  }
  
  rebuild() {
    if (!this.container) {
      console.error('HouseholdList: container not found');
      return;
    }
    
    this.container.innerHTML = '';
    
    const households = this.state.getAllHouseholds();
    if (households.length === 0) {
      this.showEmptyState();
      return;
    }
    
    const sortMode = this.state.getSortMode();
    
    if (sortMode === 'name') {
      this.buildByName();
    } else {
      this.buildByRegion();
    }
    
    this.applyFilters();
  }
  
  showEmptyState() {
    this.container.innerHTML = `
      <li style="padding: 20px; text-align: center; color: #6c757d;">
        No households loaded.<br>Load a CSV file to begin.
      </li>
    `;
  }
  
  buildByName() {
    const households = this.state.getAllHouseholds().sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    households.forEach((household, index) => {
      const listItem = this.createHouseholdItem(household);
      this.container.appendChild(listItem);
    });
    
  }
  
  buildByRegion() {
    const organized = this.organizeByRegion();
    
    // Render regions
    Object.entries(organized.regions).forEach(([regionId, regionData]) => {
      const regionGroup = this.createRegionGroup(regionData);
      this.container.appendChild(regionGroup);
    });
    
    // Render isolated households
    if (organized.isolated.length > 0) {
      const isolatedGroup = this.createIsolatedGroup(organized.isolated);
      this.container.appendChild(isolatedGroup);
    }
  }
  
  organizeByRegion() {
    const organized = {
      regions: {},
      isolated: []
    };
    
    this.state.getAllHouseholds().forEach(household => {
      if (household.isIsolated()) {
        organized.isolated.push(household);
      } else {
        const regionId = household.regionId || 0;
        
        if (!organized.regions[regionId]) {
          organized.regions[regionId] = {
            id: regionId,
            name: household.communicationsRegionName || `Region ${regionId}`,
            clusters: {},
            count: 0
          };
        }
        
        const communicationsClusterId = household.communicationsClusterId || 0;
        
        if (!organized.regions[regionId].clusters[communicationsClusterId]) {
          organized.regions[regionId].clusters[communicationsClusterId] = {
            id: communicationsClusterId,
            households: []
          };
        }
        
        organized.regions[regionId].clusters[communicationsClusterId].households.push(household);
        organized.regions[regionId].count++;
      }
    });
    
    return organized;
  }
  
  createHouseholdItem(household, extraClasses = '') {
    const li = document.createElement('li');
    li.className = `household-item ${extraClasses}`;
    
    if (household.isIsolated()) li.classList.add('isolated');
    if (household.isModified()) li.classList.add('modified');
    
    li.dataset.householdId = household.id;
    li.dataset.name = household.name;
    li.dataset.address = household.address || '';
    
    const assignment = household.isIsolated() ? 
      'Isolated' : 
      `${household.communicationsRegionName}-C${household.communicationsClusterId || 'None'}`;
    
    li.innerHTML = `
      <span>${household.name}</span>
      <span style="font-size: 11px; color: #6c757d;">${assignment}</span>
    `;
    
    // Add click handler for highlighting
    li.addEventListener('click', (event) => {
      window.highlightingManager.highlightHousehold(household.id);
      event.stopPropagation();
      event.preventDefault();
    });
    
    return li;
  }
  
  createRegionGroup(regionData) {
    const regionGroup = document.createElement('div');
    regionGroup.className = 'region-group';
    regionGroup.dataset.regionId = regionData.id;
    
    // Region header
    const regionHeader = document.createElement('div');
    regionHeader.className = 'region-header';
    regionHeader.dataset.regionId = regionData.id;
    
    regionHeader.innerHTML = `
      <span class="expand-icon">▼</span>
      <span class="region-name">${regionData.name}</span>
      <span class="region-count">(${regionData.count})</span>
    `;
    
    // Region click handler
    regionHeader.addEventListener('click', () => {
      this.toggleRegionGroup(regionGroup);
      window.highlightingManager.highlightRegion(regionData.id);
    });
    
    regionGroup.appendChild(regionHeader);
    
    // Clusters within region
    Object.entries(regionData.clusters).forEach(([communicationsClusterId, clusterData]) => {
      const clusterGroup = this.createClusterGroup(regionData.id, communicationsClusterId, clusterData);
      regionGroup.appendChild(clusterGroup);
    });
    
    return regionGroup;
  }
  
  createClusterGroup(regionId, communicationsClusterId, clusterData) {
    const clusterGroup = document.createElement('div');
    clusterGroup.className = 'cluster-group';
    clusterGroup.dataset.communicationsClusterId = `${regionId}-${communicationsClusterId}`;
    
    // Cluster header
    const clusterHeader = document.createElement('div');
    clusterHeader.className = 'cluster-header';
    clusterHeader.dataset.communicationsClusterId = `${regionId}-${communicationsClusterId}`;
    
    clusterHeader.innerHTML = `
      <span class="expand-icon">▼</span>
      <span>Cluster ${communicationsClusterId}</span>
      <span class="cluster-count">(${clusterData.households.length})</span>
    `;
    
    // Cluster click handler
    clusterHeader.addEventListener('click', () => {
      this.toggleClusterGroup(clusterGroup);
      window.highlightingManager.highlightCluster(regionId, communicationsClusterId);
    });
    
    clusterGroup.appendChild(clusterHeader);
    
    // Households in cluster
    clusterData.households.forEach(household => {
      const householdItem = this.createHouseholdItem(household);
      householdItem.dataset.regionId = regionId;
      householdItem.dataset.communicationsClusterId = `${regionId}-${communicationsClusterId}`;
      
      clusterGroup.appendChild(householdItem);
    });
    
    return clusterGroup;
  }
  
  createIsolatedGroup(isolatedHouseholds) {
    const isolatedGroup = document.createElement('div');
    isolatedGroup.className = 'isolated-group';
    
    // Isolated header
    const isolatedHeader = document.createElement('div');
    isolatedHeader.className = 'isolated-header';
    
    isolatedHeader.innerHTML = `
      <span class="expand-icon">▼</span>
      <span>Isolated Households</span>
      <span class="isolated-count">(${isolatedHouseholds.length})</span>
    `;
    
    // Isolated group click handler
    isolatedHeader.addEventListener('click', () => {
      this.toggleIsolatedGroup(isolatedGroup);
    });
    
    isolatedGroup.appendChild(isolatedHeader);
    
    // Isolated households
    isolatedHouseholds.forEach(household => {
      const householdItem = this.createHouseholdItem(household);
      isolatedGroup.appendChild(householdItem);
    });
    
    return isolatedGroup;
  }
  
  toggleRegionGroup(regionGroup) {
    const isCollapsed = regionGroup.classList.contains('collapsed');
    const icon = regionGroup.querySelector('.expand-icon');
    
    if (isCollapsed) {
      regionGroup.classList.remove('collapsed');
      if (icon) icon.textContent = '▼';
    } else {
      regionGroup.classList.add('collapsed');
      if (icon) icon.textContent = '▶';
    }
  }
  
  toggleClusterGroup(clusterGroup) {
    const isCollapsed = clusterGroup.classList.contains('collapsed');
    const icon = clusterGroup.querySelector('.expand-icon');
    
    if (isCollapsed) {
      clusterGroup.classList.remove('collapsed');
      if (icon) icon.textContent = '▼';
    } else {
      clusterGroup.classList.add('collapsed');
      if (icon) icon.textContent = '▶';
    }
  }
  
  toggleIsolatedGroup(isolatedGroup) {
    const isCollapsed = isolatedGroup.classList.contains('collapsed');
    const icon = isolatedGroup.querySelector('.expand-icon');
    
    if (isCollapsed) {
      isolatedGroup.classList.remove('collapsed');
      if (icon) icon.textContent = '▼';
    } else {
      isolatedGroup.classList.add('collapsed');
      if (icon) icon.textContent = '▶';
    }
  }
  
  applyFilters() {
    const activeFilters = this.state.getActiveFilters();
    const hasFilters = Object.keys(activeFilters).length > 0;
    
    if (!hasFilters) {
      // Clear all resource-match classes
      document.querySelectorAll('.resource-match').forEach(el => {
        el.classList.remove('resource-match');
      });
      return;
    }
    
    // Apply filters
    const filteredHouseholds = window.dataLayer.filterByResources(activeFilters);
    const matchingIds = new Set(filteredHouseholds.map(h => h.id));
    
    // Update household items
    const householdItems = document.querySelectorAll('.household-item');
    householdItems.forEach(item => {
      const householdId = item.dataset.householdId;
      const isMatch = matchingIds.has(householdId);
      
      if (isMatch) {
        item.classList.add('resource-match');
      } else {
        item.classList.remove('resource-match');
      }
    });
  }
  
  // Helper methods
  
  scrollToHousehold(householdId) {
    const item = document.querySelector(`[data-household-id="${householdId}"]`);
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  getVisibleHouseholds() {
    return Array.from(document.querySelectorAll('.household-item:not([style*="display: none"])'))
      .map(item => item.dataset.householdId)
      .filter(id => id);
  }
  
  // Public API
  refresh() {
    this.rebuild();
  }
  
  getContainer() {
    return this.container;
  }
}

// HouseholdList will be created by AppBootstrap