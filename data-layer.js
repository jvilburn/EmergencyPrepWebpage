// data-layer.js - Data access layer for Ward Directory Map

class DataLayer {
  constructor(stateManager) {
    this.state = stateManager;
    this.localStorage = window.localStorage;
    this.storageKey = 'wardDirectoryData';
    this.changesKey = 'wardDirectoryChanges';
  }
  
  // Household CRUD operations
  async addHousehold(householdData) {
    const validation = this.validateHousehold(householdData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    const household = this.createHousehold(householdData);
    this.state.addHousehold(household);
    await this.saveToLocalStorage();
    
    return household;
  }
  
  async updateHousehold(id, updates) {
    const existing = this.state.getHousehold(id);
    if (!existing) {
      throw new Error(`Household with id ${id} not found`);
    }
    
    const validation = this.validateHousehold({ ...existing, ...updates });
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    this.state.updateHousehold(id, updates);
    await this.saveToLocalStorage();
    
    return this.state.getHousehold(id);
  }
  
  async deleteHousehold(id) {
    const existing = this.state.getHousehold(id);
    if (!existing) {
      throw new Error(`Household with id ${id} not found`);
    }
    
    this.state.deleteHousehold(id);
    await this.saveToLocalStorage();
    
    return existing;
  }
  
  getHousehold(id) {
    return this.state.getHousehold(id);
  }
  
  getAllHouseholds() {
    return this.state.getAllHouseholds();
  }
  
  getHouseholdsByRegion(regionId) {
    return this.state.getHouseholdsByRegion(regionId);
  }
  
  getHouseholdsByCluster(regionId, communicationsClusterId) {
    return this.state.getHouseholdsByCluster(regionId, communicationsClusterId);
  }
  
  getIsolatedHouseholds() {
    return this.getAllHouseholds().filter(h => h.isIsolated()());
  }
  
  searchHouseholds(query) {
    if (!query || !query.trim()) {
      return this.getAllHouseholds();
    }
    
    const searchTerm = query.toLowerCase().trim();
    return this.getAllHouseholds().filter(household => {
      return household.name?.toLowerCase().includes(searchTerm) ||
             household.address?.toLowerCase().includes(searchTerm) ||
             household.specialNeeds?.toLowerCase().includes(searchTerm) ||
             household.medicalSkills?.toLowerCase().includes(searchTerm) ||
             household.recoverySkills?.toLowerCase().includes(searchTerm) ||
             household.recoveryEquipment?.toLowerCase().includes(searchTerm) ||
             household.communicationSkillsAndEquipment?.toLowerCase().includes(searchTerm);
    });
  }
  
  // Region CRUD operations
  addRegion(regionData) {
    const validation = this.validateRegion(regionData);
    if (!validation.valid) {
      throw new Error(`Region validation failed: ${validation.errors.join(', ')}`);
    }
    
    const region = {
      id: regionData.id,
      name: regionData.name,
      color: regionData.color || this.generateRegionColor(),
      bounds: regionData.bounds || [],
      created: Date.now()
    };
    
    this.state.addRegion(region);
    return region;
  }
  
  updateRegion(id, updates) {
    const existing = this.state.getRegion(id);
    if (!existing) {
      throw new Error(`Region with id ${id} not found`);
    }
    
    this.state.updateRegion(id, updates);
    return this.state.getRegion(id);
  }
  
  deleteRegion(id) {
    const existing = this.state.getRegion(id);
    if (!existing) {
      throw new Error(`Region with id ${id} not found`);
    }
    
    // Check if region has households
    const householdsInRegion = this.getHouseholdsByRegion(id);
    if (householdsInRegion.length > 0) {
      throw new Error(`Cannot delete region ${id}: it contains ${householdsInRegion.length} households`);
    }
    
    this.state.deleteRegion(id);
    return existing;
  }
  
  // CSV Import/Export
  async importFromCSV(csvData, options = {}) {
    const parseOptions = {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      ...options
    };
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        ...parseOptions,
        complete: async (results) => {
          try {
            if (results.errors.length > 0) {
              console.warn('CSV parse warnings:', results.errors);
            }
            
            const households = await this.processCSVData(results.data);
            this.state.loadHouseholds(households);
            await this.saveToLocalStorage();
            
            resolve({
              imported: households.length,
              households,
              warnings: results.errors
            });
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }
  
  exportToCSV() {
    const households = this.getAllHouseholds();
    const csvData = households.map(household => ({
      HouseholdName: household.name || '',
      Latitude: household.lat || '',
      Longitude: household.lon || '',
      Address: household.address || '',
      IsIsolated: household.isIsolated() ? 'true' : 'false',
      SpecialNeeds: household.specialNeeds || '',
      MedicalSkills: household.medicalSkills || '',
      RecoverySkills: household.recoverySkills || '',
      RecoveryEquipment: household.recoveryEquipment || '',
      CommunicationSkillsAndEquipment: household.communicationSkillsAndEquipment || '',
      CommunicationsRegionName: household.communicationsRegionName || '',
      CommunicationsClusterId: household.communicationsClusterId || ''
    }));
    
    const csv = Papa.unparse(csvData);
    return csv;
  }
  
  // localStorage operations
  async saveToLocalStorage() {
    try {
      const data = {
        households: Array.from(this.state.state.households.entries()).map(([id, household]) => [
          id, 
          household.toObject ? household.toObject() : household
        ]),
        regions: Array.from(this.state.state.regions.entries()),
        regionStats: Array.from(this.state.state.regionStats.entries()).map(([name, stats]) => [
          name,
          {
            ...stats,
            clusters: Array.from(stats.clusters) // Convert Set to Array for JSON
          }
        ]),
        clusterGroups: Array.from(this.state.state.clusterGroups.entries()),
        savedAt: Date.now()
      };
      
      this.localStorage.setItem(this.storageKey, JSON.stringify(data));
      
      // Save changes separately
      const changes = this.state.getRecentChanges();
      this.localStorage.setItem(this.changesKey, JSON.stringify(changes));
      
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw new Error('Failed to save data locally');
    }
  }
  
  async loadFromLocalStorage() {
    try {
      const data = this.localStorage.getItem(this.storageKey);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Restore households
      if (parsed.households) {
        this.state.state.households.clear();
        parsed.households.forEach(([id, householdData]) => {
          const household = Household.fromObject(householdData);
          this.state.state.households.set(id, household);
        });
      }
      
      // Restore regions
      if (parsed.regions) {
        this.state.state.regions.clear();
        parsed.regions.forEach(([id, region]) => {
          this.state.state.regions.set(id, region);
        });
      }
      
      // Restore regionStats
      if (parsed.regionStats) {
        this.state.clearRegionStats();
        parsed.regionStats.forEach(([name, stats]) => {
          this.state.setRegionStats(name, {
            ...stats,
            clusters: new Set(stats.clusters) // Convert Array back to Set
          });
        });
      }
      
      // Restore clusterGroups
      if (parsed.clusterGroups) {
        this.state.clearClusterGroups();
        parsed.clusterGroups.forEach(([key, group]) => {
          this.state.setClusterGroup(key, group);
        });
      }
      
      // Update discovered resources
      this.state.updateDiscoveredResources();
      
      // Notify that households have been loaded
      const households = this.state.getAllHouseholds();
      this.state.notify('households:loaded', households);
      
      return {
        households: households,
        regions: this.state.getAllRegions(),
        savedAt: parsed.savedAt
      };
      
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      throw new Error('Failed to load saved data');
    }
  }
  
  clearLocalStorage() {
    this.localStorage.removeItem(this.storageKey);
    this.localStorage.removeItem(this.changesKey);
  }
  
  // Resource filtering
  filterByResources(activeFilters) {
    if (!activeFilters || Object.keys(activeFilters).length === 0) {
      return this.getAllHouseholds();
    }
    
    // Group filters by type
    const filtersByType = {};
    Object.values(activeFilters).forEach(filter => {
      if (!filtersByType[filter.type]) {
        filtersByType[filter.type] = [];
      }
      filtersByType[filter.type].push(filter.field);
    });
    
    return this.getAllHouseholds().filter(household => {
      // All filter types must match (AND across types)
      return Object.entries(filtersByType).every(([type, fields]) => {
        // Any field within a type must match (OR within type)
        return fields.some(field => {
          switch (type) {
            case 'specialNeeds':
              return field === 'hasSpecialNeeds' ? 
                (household.specialNeeds && household.specialNeeds.trim()) : false;
              
            case 'medicalSkill':
              return this.hasExactResourceMatch(household.medicalSkills, field);
              
            case 'recoverySkill':
              return this.hasExactResourceMatch(household.recoverySkills, field);
              
            case 'recoveryEquipment':
              return this.hasExactResourceMatch(household.recoveryEquipment, field);
              
            case 'communicationSkillsAndEquipment':
              return this.hasExactResourceMatch(household.communicationSkillsAndEquipment, field);
              
            default:
              return false;
          }
        });
      });
    });
  }
  
  // Statistics and analytics
  getStatistics() {
    const households = this.getAllHouseholds();
    const regions = this.state.getAllRegions();
    
    const stats = {
      total: households.length,
      isolated: households.filter(h => h.isIsolated()).length,
      regions: regions.length,
      clusters: new Set(households.map(h => `${h.regionId}-${h.communicationsClusterId}`)).size,
      withSpecialNeeds: households.filter(h => h.specialNeeds && h.specialNeeds.trim()).length,
      withMedicalSkills: households.filter(h => h.medicalSkills && h.medicalSkills.trim()).length,
      withRecoverySkills: households.filter(h => h.recoverySkills && h.recoverySkills.trim()).length,
      withRecoveryEquipment: households.filter(h => h.recoveryEquipment && h.recoveryEquipment.trim()).length,
      withCommunicationEquipment: households.filter(h => h.communicationSkillsAndEquipment && h.communicationSkillsAndEquipment.trim()).length
    };
    
    stats.inRegions = stats.total - stats.isolated;
    
    return stats;
  }
  
  // Private helper methods
  createHousehold(data) {
    return new Household({
      id: data.id || this.generateHouseholdId(),
      name: data.name?.trim() || '',
      lat: parseFloat(data.lat) || 0,
      lon: parseFloat(data.lon) || 0,
      address: data.address?.trim() || '',
      specialNeeds: data.specialNeeds?.trim() || '',
      medicalSkills: data.medicalSkills?.trim() || '',
      recoverySkills: data.recoverySkills?.trim() || '',
      recoveryEquipment: data.recoveryEquipment?.trim() || '',
      communicationSkillsAndEquipment: data.communicationSkillsAndEquipment?.trim() || '',
      communicationsRegionName: data.communicationsRegionName?.trim() || '',
      communicationsClusterId: parseInt(data.communicationsClusterId) || 0,
      // Set original values for change tracking
      originalCommunicationsRegionName: data.communicationsRegionName?.trim() || '',
      originalCommunicationsClusterId: parseInt(data.communicationsClusterId) || 0,
      created: Date.now(),
      modified: Date.now()
    });
  }
  
  async processCSVData(csvRows) {
    const households = [];
    const columnMappings = this.detectColumnMappings(csvRows[0] || {});
    
    // Initialize region/cluster stats
    this.state.clearRegionStats();
    this.state.clearClusterGroups();
    
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      if (!row || !this.isValidRow(row)) {
        console.log(`DataLayer: Skipping invalid row ${i + 1}:`, row);
        continue;
      }
      
      try {
        const household = this.mapCSVRowToHousehold(row, columnMappings, `row_${i}`);
        households.push(household);
        
        // Build region/cluster stats incrementally
        this.updateRegionStatsIncremental(household);
        
      } catch (error) {
        console.warn(`DataLayer: Skipping row ${i + 1}:`, error.message, row);
      }
    }
    
    return households;
  }
  
  updateRegionStatsIncremental(household) {
    if (household.isIsolated()) return;
    
    const communicationsRegionName = household.communicationsRegionName;
    const communicationsClusterId = household.communicationsClusterId;
    
    // Handle independent clusters (no region name but has cluster ID)
    if (!communicationsRegionName && communicationsClusterId > 0) {
      const clusterKey = `independent-${communicationsClusterId}`;
      const existingGroup = this.state.getClusterGroups().get(clusterKey);
      if (!existingGroup) {
        this.state.setClusterGroup(clusterKey, {
          communicationsRegionName: null, // No region
          communicationsClusterId: communicationsClusterId,
          color: '#6c757d', // Gray for independent clusters
          bounds: []
        });
      }
      const group = this.state.getClusterGroups().get(clusterKey);
      group.bounds.push([household.lat, household.lon]);
      return;
    }
    
    if (!communicationsRegionName) return;
    
    // Create region stats if not exists
    const existingRegionStats = this.state.getRegionStats().get(communicationsRegionName);
    if (!existingRegionStats) {
      const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
                     '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'];
      const colorIndex = this.state.getRegionStats().size % colors.length;
      
      this.state.setRegionStats(communicationsRegionName, {
        name: communicationsRegionName,
        count: 0,
        color: colors[colorIndex],
        bounds: [],
        clusters: new Set()
      });
    }
    
    // Update region stats
    const regionStats = this.state.getRegionStats().get(communicationsRegionName);
    regionStats.count++;
    regionStats.bounds.push([household.lat, household.lon]);
    
    if (communicationsClusterId > 0) {
      regionStats.clusters.add(communicationsClusterId);
      
      // Create cluster group stats
      const clusterKey = `${communicationsRegionName}-${communicationsClusterId}`;
      const existingClusterGroup = this.state.getClusterGroups().get(clusterKey);
      if (!existingClusterGroup) {
        this.state.setClusterGroup(clusterKey, {
          communicationsRegionName: communicationsRegionName,
          communicationsClusterId: communicationsClusterId,
          color: regionStats.color,
          bounds: []
        });
      }
      const clusterGroup = this.state.getClusterGroups().get(clusterKey);
      clusterGroup.bounds.push([household.lat, household.lon]);
    }
  }
  
  detectColumnMappings(headerRow) {
    // Use exact column names as defined in CLAUDE.md CSV format
    return {
      name: 'HouseholdName',
      lat: 'Latitude', 
      lon: 'Longitude',
      address: 'Address',
      isIsolated: 'IsIsolated',
      specialNeeds: 'SpecialNeeds',
      medicalSkills: 'MedicalSkills',
      recoverySkills: 'RecoverySkills', 
      recoveryEquipment: 'RecoveryEquipment',
      communicationSkillsAndEquipment: 'CommunicationSkillsAndEquipment',
      communicationsRegionName: 'CommunicationsRegionName',
      communicationsClusterId: 'CommunicationsClusterId'
    };
  }
  
  mapCSVRowToHousehold(row, mappings, id) {
    const household = { id };
    
    Object.entries(mappings).forEach(([field, column]) => {
      if (column && row[column] !== undefined) {
        household[field] = row[column];
      }
    });
    
    return this.createHousehold(household);
  }
  
  isValidRow(row) {
    return row && (row.name || row.HouseholdName || row.householdname);
  }
  
  validateHousehold(household) {
    const errors = [];
    
    if (!household.name || !household.name.trim()) {
      errors.push('Household name is required');
    }
    
    if (!this.isValidLatLng(household.lat, household.lon)) {
      errors.push('Valid coordinates are required');
    }
    
    if (household.regionId && household.regionId < 0) {
      errors.push('Region ID must be positive');
    }
    
    if (household.communicationsClusterId && household.communicationsClusterId < 0) {
      errors.push('Cluster ID must be positive');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  validateRegion(region) {
    const errors = [];
    
    if (!region.id || region.id <= 0) {
      errors.push('Region ID is required and must be positive');
    }
    
    if (!region.name || !region.name.trim()) {
      errors.push('Region name is required');
    }
    
    // Check for duplicate region ID
    if (this.state.getRegion(region.id)) {
      errors.push(`Region with ID ${region.id} already exists`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  isValidLatLng(lat, lon) {
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);
    
    return !isNaN(numLat) && !isNaN(numLon) && 
           numLat >= -90 && numLat <= 90 && 
           numLon >= -180 && numLon <= 180 &&
           numLat !== 0 && numLon !== 0; // Exclude 0,0 coordinates
  }
  
  hasExactResourceMatch(householdField, filterValue) {
    if (!householdField || !filterValue) return false;
    
    // Split by comma and trim each item
    const householdItems = householdField.split(',').map(item => item.trim().toLowerCase());
    const filterValueLower = filterValue.toLowerCase();
    
    // Check for exact match in the list
    return householdItems.some(item => item === filterValueLower);
  }

  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const str = value.toLowerCase().trim();
      return str === 'true' || str === '1' || str === 'yes' || str === 'y';
    }
    return !!value;
  }
  
  generateHouseholdId() {
    const existing = new Set(this.getAllHouseholds().map(h => h.id));
    let id = `h${Date.now()}`;
    let counter = 1;
    
    while (existing.has(id)) {
      id = `h${Date.now()}_${counter}`;
      counter++;
    }
    
    return id;
  }
  
  generateRegionColor() {
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
    ];
    
    const usedColors = new Set(this.state.getAllRegions().map(r => r.color));
    const availableColors = colors.filter(color => !usedColors.has(color));
    
    if (availableColors.length > 0) {
      return availableColors[0];
    }
    
    // Generate random color if all predefined colors are used
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }
}

// Create global instance
window.dataLayer = new DataLayer(window.stateManager);