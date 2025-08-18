// data.js - Data management and processing

// Global data variables - explicitly attach to window
window.wardData = window.wardData || [];
window.changes = window.changes || [];
window.regionStats = window.regionStats || {};
window.clusterGroups = window.clusterGroups || {};

// Save data to localStorage
function saveDataLocally() {
  if (window.wardData && window.wardData.length > 0) {
    try {
      localStorage.setItem('wardMapData', JSON.stringify(window.wardData));
      localStorage.setItem('wardMapChanges', JSON.stringify(window.changes));
      localStorage.setItem('wardMapTimestamp', new Date().toISOString());
    } catch(e) {
      console.error('Could not save to localStorage:', e);
    }
  }
}

// Load saved data from localStorage
function loadSavedData() {
  try {
    const savedData = localStorage.getItem('wardMapData');
    const savedChanges = localStorage.getItem('wardMapChanges');
    const timestamp = localStorage.getItem('wardMapTimestamp');
    
    if (savedData) {
      window.wardData = JSON.parse(savedData);
      window.changes = JSON.parse(savedChanges || '[]');
      
      if (window.wardData.length > 0) {
        processLoadedData();
        
        const date = timestamp ? new Date(timestamp) : null;
        const dateStr = date ? date.toLocaleDateString() : 'unknown date';
        setStatus(`Loaded ${window.wardData.length} households from saved data (${dateStr})`, 'success');
      }
    }
  } catch(e) {
    console.error('Could not load saved data:', e);
  }
}

// Load and parse CSV file
function loadFile(file) {
  setStatus('Loading ' + file.name + '...', 'info');
  
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      processData(results.data);
    },
    error: function(error) {
      setStatus('Error reading file: ' + error.message, 'error');
    }
  });
}

// Process CSV data
function processData(data) {
  if (data.length < 2) {
    setStatus('No data found in file', 'error');
    return;
  }
  
  // Parse headers to set column positions
  const headers = data[0];
  const COLUMNS = parseHeaders(headers);
  
  // Clear existing data
  resetDataStructures();
  
  const bounds = [];
  let validCount = 0;
  let isolatedCount = 0;
  
  // Process rows (skip header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length < 3) continue;
    
    const lat = parseFloat(row[COLUMNS.lat]);
    const lon = parseFloat(row[COLUMNS.lon]);
    
    if (isNaN(lat) || isNaN(lon)) continue;
    
    // Check isolation status from the isIsolated column
    const isIsolatedFlag = row[COLUMNS.isIsolated] === 'true' || 
                           row[COLUMNS.isIsolated] === 'True';
    
    // For the initial parameters, use dummy values since we'll derive region info in createHouseholdObject
    const regionId = -1;
    const clusterId = -1;
    
    const household = createHouseholdObject(row, COLUMNS, i, lat, lon, regionId, clusterId, isIsolatedFlag);
    window.wardData.push(household);
    
    if (household.isIsolated) {
      isolatedCount++;
    } else if (household.regionId > 0 && !isNaN(household.regionId)) {
      updateRegionStats(household, lat, lon);
    }
    
    validCount++;
  }
  
  // Process loaded data
  processLoadedData();
  
  // Update discovered resources
  if (window.updateDiscoveredResources) {
    window.updateDiscoveredResources();
  }
  
  // Build dynamic resource filters
  if (window.buildResourceFilters) {
    window.buildResourceFilters();
  }
  
  // Update household list
  if (window.buildHouseholdList) {
    window.buildHouseholdList();
  }
  
  // Save to localStorage
  saveDataLocally();
  
  if (validCount > 0) {
    setStatus(`✓ Loaded ${validCount} households (${isolatedCount} isolated)`, 'success');
    const allBounds = window.wardData.map(h => [h.lat, h.lon]);
    if (window.map && allBounds.length > 0) {
      window.map.fitBounds(allBounds, { padding: [50, 50] });
    }
  } else {
    setStatus('No valid households found', 'error');
  }
}

// Create household object from CSV row
function createHouseholdObject(row, COLUMNS, index, lat, lon, regionId, clusterId, isIsolatedFlag) {
  // Get region and cluster info from communications columns if available
  const communicationsRegionName = COLUMNS.communicationsRegionName >= 0 ? (row[COLUMNS.communicationsRegionName] || '') : '';
  const communicationsClusterId = COLUMNS.communicationsClusterId >= 0 ? 
    (row[COLUMNS.communicationsClusterId] ? parseInt(row[COLUMNS.communicationsClusterId]) : -1) : -1;
  
  // Derive region info from communications data if no explicit region columns
  let derivedRegionId = regionId;
  let derivedRegionName = '';
  let derivedClusterId = clusterId;
  
  if (communicationsRegionName) {
    derivedRegionName = communicationsRegionName;
    // Try to derive region ID from region name
    if (communicationsRegionName.toLowerCase().includes('region 1')) derivedRegionId = 1;
    else if (communicationsRegionName.toLowerCase().includes('west')) derivedRegionId = 2;
    else if (communicationsRegionName.toLowerCase().includes('east')) derivedRegionId = 3;
    else if (communicationsRegionName.toLowerCase().includes('north')) derivedRegionId = 4;
    else if (communicationsRegionName.toLowerCase().includes('south')) derivedRegionId = 5;
    else if (communicationsRegionName.toLowerCase().includes('central')) derivedRegionId = 6;
    else derivedRegionId = -1;
  }
  
  if (communicationsClusterId >= 0) {
    derivedClusterId = communicationsClusterId;
  }
  
  const household = {
    id: 'h' + index,
    name: row[COLUMNS.name] || 'Household ' + index,
    lat: lat,
    lon: lon,
    address: row[COLUMNS.address] || '',
    regionId: isIsolatedFlag ? -1 : derivedRegionId,
    regionName: isIsolatedFlag ? '' : derivedRegionName,
    clusterId: isIsolatedFlag ? -1 : derivedClusterId,
    isIsolated: isIsolatedFlag,
    originalRegionId: isIsolatedFlag ? -1 : derivedRegionId,
    originalClusterId: isIsolatedFlag ? -1 : derivedClusterId,
    specialNeeds: COLUMNS.specialNeeds >= 0 ? (row[COLUMNS.specialNeeds] || '') : '',
    medicalSkills: COLUMNS.medicalSkills >= 0 ? (row[COLUMNS.medicalSkills] || '') : '',
    recoverySkills: COLUMNS.recoverySkills >= 0 ? (row[COLUMNS.recoverySkills] || '') : '',
    recoveryEquipment: COLUMNS.recoveryEquipment >= 0 ? (row[COLUMNS.recoveryEquipment] || '') : '',
    communicationSkillsAndEquipment: COLUMNS.communicationSkillsAndEquipment >= 0 ? (row[COLUMNS.communicationSkillsAndEquipment] || '') : ''
  };
  
  return household;
}

// Update region statistics for a household
function updateRegionStats(household, lat, lon) {
  if (!window.regionStats[household.regionId]) {
    window.regionStats[household.regionId] = {
      name: household.regionName || 'Region ' + household.regionId,
      count: 0,
      color: COLORS[(household.regionId - 1) % COLORS.length],
      bounds: [],
      clusters: new Set()
    };
  }
  window.regionStats[household.regionId].count++;
  window.regionStats[household.regionId].clusters.add(household.clusterId);
  window.regionStats[household.regionId].bounds.push([lat, lon]);
  
  if (household.clusterId > 0 && !isNaN(household.clusterId)) {
    const clusterKey = household.regionId + '-' + household.clusterId;
    if (!window.clusterGroups[clusterKey]) {
      window.clusterGroups[clusterKey] = {
        regionId: household.regionId,
        clusterId: household.clusterId,
        color: COLORS[(household.regionId - 1) % COLORS.length],
        bounds: []
      };
    }
    window.clusterGroups[clusterKey].bounds.push([lat, lon]);
  }
}

// Reset data structures
function resetDataStructures() {
  if (window.markersLayer) window.markersLayer.clearLayers();
  if (window.clustersLayer) window.clustersLayer.clearLayers();
  if (window.regionsLayer) window.regionsLayer.clearLayers();
  
  window.wardData = [];
  window.markers = {};
  window.changes = [];
  window.regionStats = {};
  window.clusterGroups = {};
  
  if (window.updateChangesCounter) window.updateChangesCounter();
  
  document.getElementById('searchBox').value = '';
}

// Process loaded data (from CSV or localStorage)
function processLoadedData() {
  if (window.markersLayer) window.markersLayer.clearLayers();
  if (window.clustersLayer) window.clustersLayer.clearLayers();
  if (window.regionsLayer) window.regionsLayer.clearLayers();
  
  window.markers = {};
  window.regionStats = {};
  window.clusterGroups = {};
  
  const bounds = [];
  
  window.wardData.forEach(household => {
    // Rebuild statistics
    if (!household.isIsolated) {
      if (household.regionId > 0 && !isNaN(household.regionId)) {
        // Regular region statistics
        updateRegionStats(household, household.lat, household.lon);
      } else if (household.regionId === 0 && household.clusterId > 0) {
        // Independent cluster (no region)
        const clusterKey = `0-${household.clusterId}`;
        if (!window.clusterGroups[clusterKey]) {
          window.clusterGroups[clusterKey] = {
            regionId: 0,
            clusterId: household.clusterId,
            color: '#6c757d', // Gray for independent clusters
            bounds: []
          };
        }
        window.clusterGroups[clusterKey].bounds.push([household.lat, household.lon]);
      }
    }
    
    // Create markers will be handled by map.js
    bounds.push([household.lat, household.lon]);
  });
  
  // Update discovered resources
  if (window.updateDiscoveredResources) {
    window.updateDiscoveredResources();
  }
  
  // Build dynamic resource filters
  if (window.buildResourceFilters) {
    window.buildResourceFilters();
  }
  
  // Update UI components if functions exist
  if (window.createMapMarkers) window.createMapMarkers();
  if (window.updateBoundaries) window.updateBoundaries();
  if (window.updateChangesCounter) window.updateChangesCounter();
  if (window.buildHouseholdList) window.buildHouseholdList();
  
  if (bounds.length > 0 && window.map) {
    window.map.fitBounds(bounds, { padding: [50, 50] });
    // Force map to refresh tiles after fitting bounds
    setTimeout(() => {
      window.map.invalidateSize();
      window.map._onResize();
    }, 100);
  }
}

// Recalculate statistics after household changes
function recalculateStatistics() {
  window.regionStats = {};
  window.clusterGroups = {};
  
  window.wardData.forEach(household => {
    if (!household.isIsolated) {
      if (household.regionId > 0 && !isNaN(household.regionId)) {
        // Regular region statistics
        updateRegionStats(household, household.lat, household.lon);
      } else if (household.regionId === 0 && household.clusterId > 0) {
        // Independent cluster (no region)
        const clusterKey = `0-${household.clusterId}`;
        if (!window.clusterGroups[clusterKey]) {
          window.clusterGroups[clusterKey] = {
            regionId: 0,
            clusterId: household.clusterId,
            color: '#6c757d', // Gray for independent clusters
            bounds: []
          };
        }
        window.clusterGroups[clusterKey].bounds.push([household.lat, household.lon]);
      }
    }
  });
}

// Export data to CSV
function exportData() {
  if (!window.wardData || window.wardData.length === 0) {
    alert('No data to export');
    return;
  }
  
  // Build header for new format
  let csv = 'HouseholdName,Latitude,Longitude,Address,IsIsolated,SpecialNeeds,MedicalSkills,RecoverySkills,RecoveryEquipment,CommunicationSkillsAndEquipment,CommunicationsRegionName,CommunicationsClusterId\n';
  
  // Export data rows
  window.wardData.forEach(h => {
    csv += `"${h.name}",${h.lat},${h.lon},"${h.address}",`;
    csv += `${h.isIsolated},"${h.specialNeeds || ''}","${h.medicalSkills || ''}","${h.recoverySkills || ''}","${h.recoveryEquipment || ''}","${h.communicationSkillsAndEquipment || ''}","${h.regionName || ''}",${h.clusterId}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ward_data_modified_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  window.URL.revokeObjectURL(url);
  
  if (window.changes && window.changes.length > 0) {
    alert(`Exported data with ${window.changes.length} modifications`);
  }
}

// Update household assignment
function updateHouseholdAssignment(household, newAssignment) {
  // Record change
  window.changes.push({
    householdId: household.id,
    householdName: household.name,
    fromRegion: household.regionId,
    fromCluster: household.clusterId,
    fromRegionName: household.regionName,
    toRegion: newAssignment.regionId,
    toCluster: newAssignment.clusterId,
    toRegionName: newAssignment.regionName,
    timestamp: new Date().toISOString()
  });
  
  // Update household data
  const householdIndex = window.wardData.findIndex(h => h.id === household.id);
  if (householdIndex !== -1) {
    window.wardData[householdIndex].regionId = newAssignment.regionId;
    window.wardData[householdIndex].clusterId = newAssignment.clusterId;
    window.wardData[householdIndex].regionName = newAssignment.regionName;
    window.wardData[householdIndex].isIsolated = newAssignment.regionId === -1;
    
    household.regionId = newAssignment.regionId;
    household.clusterId = newAssignment.clusterId;
    household.regionName = newAssignment.regionName;
    household.isIsolated = newAssignment.regionId === -1;
  }
}

// Update household resources
function updateHouseholdResources(household, resources) {
  const householdIndex = window.wardData.findIndex(h => h.id === household.id);
  if (householdIndex !== -1) {
    Object.keys(resources).forEach(key => {
      window.wardData[householdIndex][key] = resources[key];
      household[key] = resources[key];
    });
  }
}

// Undo last change
function undoLastChange() {
  if (!window.changes || window.changes.length === 0) return;
  
  const lastChange = window.changes.pop();
  const household = window.wardData.find(h => h.id === lastChange.householdId);
  
  if (household) {
    household.regionId = lastChange.fromRegion;
    household.clusterId = lastChange.fromCluster;
    household.isIsolated = lastChange.fromRegion === -1;
    household.regionName = lastChange.fromRegionName || '';
    
    if (window.updateMarkerAfterChange) {
      window.updateMarkerAfterChange(household);
    }
    
    recalculateStatistics();
    if (window.updateBoundaries) window.updateBoundaries();
    if (window.updateChangesCounter) window.updateChangesCounter();
    if (window.buildHouseholdList) window.buildHouseholdList();
    saveDataLocally();
    
    setStatus('Undone: ' + household.name + ' reassignment', 'info');
  }
}

// View all changes
function viewChanges() {
  if (!window.changes || window.changes.length === 0) {
    alert('No changes have been made');
    return;
  }
  
  let message = 'Changes made:\n\n';
  window.changes.forEach((change, i) => {
    const from = change.fromRegion === -1 ? 'Isolated' : 
      `${change.fromRegionName || 'Region ' + change.fromRegion}, Cluster ${change.fromCluster}`;
    const to = change.toRegion === -1 ? 'Isolated' : 
      `${change.toRegionName || 'Region ' + change.toRegion}, Cluster ${change.toCluster}`;
    message += `${i + 1}. ${change.householdName}: ${from} → ${to}\n`;
  });
  
  alert(message);
}