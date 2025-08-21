// state-manager.js - Centralized state management for Ward Directory Map

class StateManager {
  constructor() {
    this.state = {
      households: new Map(),
      regions: new Map(),
      clusters: new Map(),
      ui: {
        selectedHouseholds: new Set(),
        highlightedItems: new Set(),
        activeFilters: new Map(),
        sortMode: 'name',
        sidebarCollapsed: false
      },
      map: {
        markers: new Map(),
        bounds: null,
        zoom: 10
      },
      resources: {
        discoveredMedicalSkills: new Set(),
        discoveredRecoverySkills: new Set(),
        discoveredRecoveryEquipment: new Set(),
        discoveredCommunicationSkillsAndEquipment: new Set()
      },
      // Region and cluster statistics for colors and boundaries
      regionStats: new Map(),
      clusterGroups: new Map(),
      // Main data storage
      wardData: []
    };
    
    this.listeners = new Map();
    this.changes = [];
    this.maxChanges = 50;
  }
  
  // Event system
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    return () => {
      this.listeners.get(event).delete(callback);
    };
  }
  
  notify(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
  
  // Household management
  addHousehold(household) {
    this.state.households.set(household.id, household);
    this.recordChange('add', household.id, null, household);
    this.notify('household:added', household);
  }
  
  updateHousehold(id, updates) {
    const household = this.state.households.get(id);
    if (household) {
      const oldData = { ...household };
      Object.assign(household, updates);
      this.recordChange('update', id, oldData, household);
      this.updateDiscoveredResources(); // Refresh resources when household data changes
      this.notify('household:updated', { id, household, oldData });
    }
  }
  
  deleteHousehold(id) {
    const household = this.state.households.get(id);
    if (household) {
      this.state.households.delete(id);
      this.recordChange('delete', id, household, null);
      this.notify('household:deleted', { id, household });
    }
  }
  
  getHousehold(id) {
    return this.state.households.get(id);
  }
  
  getAllHouseholds() {
    return Array.from(this.state.households.values());
  }
  
  getHouseholdsByRegion(communicationsRegionName) {
    return this.getAllHouseholds().filter(h => h.communicationsRegionName === communicationsRegionName);
  }
  
  getHouseholdsByCluster(communicationsRegionName, communicationsClusterId) {
    return this.getAllHouseholds().filter(h => 
      h.communicationsRegionName === communicationsRegionName && h.communicationsClusterId === communicationsClusterId
    );
  }
  
  // Region management
  addRegion(region) {
    this.state.regions.set(region.id, { ...region });
    this.notify('region:added', region);
  }
  
  updateRegion(id, updates) {
    const region = this.state.regions.get(id);
    if (region) {
      Object.assign(region, updates);
      this.notify('region:updated', { id, region });
    }
  }
  
  deleteRegion(id) {
    const region = this.state.regions.get(id);
    if (region) {
      this.state.regions.delete(id);
      this.notify('region:deleted', { id, region });
    }
  }
  
  getRegion(id) {
    return this.state.regions.get(id);
  }
  
  getAllRegions() {
    return Array.from(this.state.regions.values());
  }
  
  // UI state management
  setSelectedHouseholds(householdIds) {
    this.state.ui.selectedHouseholds.clear();
    householdIds.forEach(id => this.state.ui.selectedHouseholds.add(id));
    this.notify('ui:selection:changed', householdIds);
  }
  
  addSelectedHousehold(householdId) {
    this.state.ui.selectedHouseholds.add(householdId);
    this.notify('ui:selection:added', householdId);
  }
  
  removeSelectedHousehold(householdId) {
    this.state.ui.selectedHouseholds.delete(householdId);
    this.notify('ui:selection:removed', householdId);
  }
  
  clearSelection() {
    this.state.ui.selectedHouseholds.clear();
    this.notify('ui:selection:cleared');
  }
  
  isSelected(householdId) {
    return this.state.ui.selectedHouseholds.has(householdId);
  }
  
  getSelectedHouseholds() {
    return Array.from(this.state.ui.selectedHouseholds);
  }
  
  // Highlighting management
  setHighlightedItems(items) {
    this.state.ui.highlightedItems.clear();
    items.forEach(item => this.state.ui.highlightedItems.add(item));
    this.notify('ui:highlight:changed', items);
  }
  
  addHighlightedItem(item) {
    this.state.ui.highlightedItems.add(item);
    this.notify('ui:highlight:added', item);
  }
  
  clearHighlights() {
    this.state.ui.highlightedItems.clear();
    this.notify('ui:highlight:cleared');
  }
  
  isHighlighted(item) {
    return this.state.ui.highlightedItems.has(item);
  }
  
  getHighlightedItems() {
    return Array.from(this.state.ui.highlightedItems);
  }
  
  // Filter management
  setActiveFilters(filters) {
    this.state.ui.activeFilters.clear();
    Object.entries(filters).forEach(([key, value]) => {
      this.state.ui.activeFilters.set(key, value);
    });
    this.notify('ui:filters:changed', filters);
  }
  
  addFilter(key, value) {
    this.state.ui.activeFilters.set(key, value);
    this.notify('ui:filter:added', { key, value });
  }
  
  removeFilter(key) {
    this.state.ui.activeFilters.delete(key);
    this.notify('ui:filter:removed', key);
  }
  
  clearFilters() {
    this.state.ui.activeFilters.clear();
    this.notify('ui:filters:cleared');
  }
  
  getActiveFilters() {
    return Object.fromEntries(this.state.ui.activeFilters);
  }
  
  // Sort mode
  setSortMode(mode) {
    this.state.ui.sortMode = mode;
    this.notify('ui:sort:changed', mode);
  }
  
  getSortMode() {
    return this.state.ui.sortMode;
  }
  
  // Sidebar state
  setSidebarCollapsed(collapsed) {
    this.state.ui.sidebarCollapsed = collapsed;
    this.notify('ui:sidebar:toggled', collapsed);
  }
  
  isSidebarCollapsed() {
    return this.state.ui.sidebarCollapsed;
  }
  
  // Map state
  setMapMarker(householdId, marker) {
    this.state.map.markers.set(householdId, marker);
  }
  
  getMapMarker(householdId) {
    return this.state.map.markers.get(householdId);
  }
  
  getAllMapMarkers() {
    return this.state.map.markers;
  }
  
  clearMapMarkers() {
    this.state.map.markers.clear();
  }
  
  // Resource management
  updateDiscoveredResources() {
    const resources = {
      medicalSkills: new Set(),
      recoverySkills: new Set(),
      recoveryEquipment: new Set(),
      communicationSkillsAndEquipment: new Set()
    };
    
    this.getAllHouseholds().forEach(household => {
      // Process medical skills
      if (household.medicalSkills) {
        household.medicalSkills.split(',')
          .map(skill => skill.trim().toLowerCase())
          .filter(skill => skill)
          .forEach(skill => resources.medicalSkills.add(skill));
      }
      
      // Process recovery skills
      if (household.recoverySkills) {
        household.recoverySkills.split(',')
          .map(skill => skill.trim().toLowerCase())
          .filter(skill => skill)
          .forEach(skill => resources.recoverySkills.add(skill));
      }
      
      // Process recovery equipment
      if (household.recoveryEquipment) {
        household.recoveryEquipment.split(',')
          .map(equipment => equipment.trim().toLowerCase())
          .filter(equipment => equipment)
          .forEach(equipment => resources.recoveryEquipment.add(equipment));
      }
      
      // Process communication skills and equipment
      if (household.communicationSkillsAndEquipment) {
        household.communicationSkillsAndEquipment.split(',')
          .map(item => item.trim().toLowerCase())
          .filter(item => item)
          .forEach(item => resources.communicationSkillsAndEquipment.add(item));
      }
    });
    
    this.state.resources = resources;
    this.notify('resources:updated', resources);
  }
  
  getDiscoveredResources() {
    return { ...this.state.resources };
  }
  
  // Change tracking
  recordChange(type, id, oldValue, newValue) {
    const change = {
      type,
      id,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      timestamp: Date.now()
    };
    
    this.changes.push(change);
    
    // Keep only recent changes
    if (this.changes.length > this.maxChanges) {
      this.changes.shift();
    }
    
    this.notify('change:recorded', change);
  }
  
  getRecentChanges() {
    return [...this.changes];
  }
  
  undoLastChange() {
    const lastChange = this.changes.pop();
    if (!lastChange) return null;
    
    switch (lastChange.type) {
      case 'add':
        this.deleteHousehold(lastChange.id);
        break;
      case 'update':
        if (lastChange.oldValue) {
          this.state.households.set(lastChange.id, { ...lastChange.oldValue });
        }
        break;
      case 'delete':
        if (lastChange.oldValue) {
          this.addHousehold(lastChange.oldValue);
        }
        break;
    }
    
    this.notify('change:undone', lastChange);
    return lastChange;
  }
  
  // Bulk operations
  loadHouseholds(households) {
    this.state.households.clear();
    households.forEach(household => {
      this.state.households.set(household.id, household);
    });
    this.updateDiscoveredResources();
    this.notify('households:loaded', households);
  }
  
  // Region and cluster statistics management
  getRegionStats() {
    return this.state.regionStats;
  }
  
  setRegionStats(regionName, stats) {
    this.state.regionStats.set(regionName, stats);
    this.notify('regionStats:updated', { regionName, stats });
  }
  
  clearRegionStats() {
    this.state.regionStats.clear();
    this.notify('regionStats:cleared');
  }
  
  getClusterGroups() {
    return this.state.clusterGroups;
  }
  
  setClusterGroup(clusterKey, group) {
    this.state.clusterGroups.set(clusterKey, group);
    this.notify('clusterGroups:updated', { clusterKey, group });
  }
  
  clearClusterGroups() {
    this.state.clusterGroups.clear();
    this.notify('clusterGroups:cleared');
  }
  
  // Ward data management
  getWardData() {
    return [...this.state.wardData];
  }
  
  setWardData(data) {
    this.state.wardData = [...data];
    this.notify('wardData:updated', data);
  }
  
  clearWardData() {
    this.state.wardData = [];
    this.notify('wardData:cleared');
  }

  // Statistics
  getStats() {
    const households = this.getAllHouseholds();
    const total = households.length;
    const isolated = households.filter(h => h.isIsolated()).length;
    const regions = this.state.regions.size;
    
    return {
      totalHouseholds: total,
      isolatedHouseholds: isolated,
      householdsInRegions: total - isolated,
      totalRegions: regions,
      totalChanges: this.changes.length
    };
  }
}

// Create global instance
window.stateManager = new StateManager();