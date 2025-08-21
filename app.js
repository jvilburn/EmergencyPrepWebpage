// app.js - Main application initialization and control

// Global application state
let selectedHousehold = null;

// Open household edit dialog
function openHouseholdEditDialog(household) {
  selectedHousehold = household;
  
  let dialogHtml = `
    <div style="margin-bottom: 10px;">
      <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Edit Household</h3>
    </div>
    
    <div style="margin: 10px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
      <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 15px;">
        <label style="display: block; font-size: 13px;">
          <span style="display: block; margin-bottom: 3px;">Household Name:</span>
          <input type="text" id="edit-name" value="${household.name || ''}" style="width: 100%; padding: 5px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px;">
        </label>
        <label style="display: block; font-size: 13px;">
          <span style="display: block; margin-bottom: 3px;">Address:</span>
          <input type="text" id="edit-address" value="${household.address || ''}" style="width: 100%; padding: 5px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px;">
        </label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <label style="display: block; font-size: 13px;">
            <span style="display: block; margin-bottom: 3px;">Latitude:</span>
            <input type="number" step="any" id="edit-lat" value="${household.lat || ''}" style="width: 100%; padding: 5px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px;">
          </label>
          <label style="display: block; font-size: 13px;">
            <span style="display: block; margin-bottom: 3px;">Longitude:</span>
            <input type="number" step="any" id="edit-lon" value="${household.lon || ''}" style="width: 100%; padding: 5px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px;">
          </label>
        </div>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: 500;">Special Needs:</label>
        <textarea id="edit-special-needs" style="width: 100%; height: 35px; padding: 4px; border: 1px solid #dee2e6; border-radius: 3px; font-size: 12px; resize: vertical;">${household.specialNeeds || ''}</textarea>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: 500;">Medical Skills:</label>
        <textarea id="edit-medical-skills" style="width: 100%; height: 45px; padding: 4px; border: 1px solid #dee2e6; border-radius: 3px; font-size: 12px; resize: vertical;">${household.medicalSkills || ''}</textarea>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: 500;">Recovery Skills:</label>
        <textarea id="edit-recovery-skills" style="width: 100%; height: 45px; padding: 4px; border: 1px solid #dee2e6; border-radius: 3px; font-size: 12px; resize: vertical;">${household.recoverySkills || ''}</textarea>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: 500;">Recovery Equipment:</label>
        <textarea id="edit-recovery-equipment" style="width: 100%; height: 45px; padding: 4px; border: 1px solid #dee2e6; border-radius: 3px; font-size: 12px; resize: vertical;">${household.recoveryEquipment || ''}</textarea>
      </div>
    </div>
    
    <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
      <h4 style="margin: 0 0 15px 0; font-size: 14px; color: #2c3e50;">Communications</h4>
      <div style="margin-bottom: 8px;">
        <label style="display: block; font-size: 12px; margin-bottom: 3px; font-weight: 500;">Communication Skills and Equipment:</label>
        <textarea id="edit-communication-skills-and-equipment" style="width: 100%; height: 60px; padding: 4px; border: 1px solid #dee2e6; border-radius: 3px; font-size: 12px; resize: vertical;">${household.communicationSkillsAndEquipment || ''}</textarea>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <label style="display: block; font-size: 13px;">
          <span style="display: block; margin-bottom: 3px;">Region:</span>
          <select id="edit-region" onchange="updateClusterOptions()" style="width: 100%; padding: 5px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px;">`;
  
  // Build region options
  dialogHtml += `<option value="-1" ${household.isIsolated ? 'selected' : ''}>Isolated</option>`;
  
  const regionStats = window.stateManager.getRegionStats();
  regionStats.forEach((region, regionName) => {
    const selected = !household.isIsolated() && household.communicationsRegionName === regionName ? 'selected' : '';
    dialogHtml += `<option value="${regionName}" ${selected}>${region.name}</option>`;
  });
  
  dialogHtml += `
          </select>
        </label>
        <label style="display: block; font-size: 13px;">
          <span style="display: block; margin-bottom: 3px;">Cluster:</span>
          <select id="edit-cluster" style="width: 100%; padding: 5px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 13px;">
            <option value="-1">No Cluster</option>
          </select>
        </label>
      </div>
    </div>
  `;
  
  dialogHtml += `
    </div>
    <div class="dialog-buttons">
      <button class="btn btn-secondary" id="cancelHouseholdBtn">Cancel</button>
      <button class="btn btn-primary" id="confirmHouseholdBtn">Save Changes</button>
    </div>
  `;
  
  document.getElementById('householdEditDialog').innerHTML = dialogHtml;
  
  // Initialize cluster options based on current region
  updateClusterOptions();
  
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('householdEditDialog').classList.add('active');
}

// Update cluster dropdown options based on selected region
function updateClusterOptions() {
  const regionSelect = document.getElementById('edit-region');
  const clusterSelect = document.getElementById('edit-cluster');
  
  if (!regionSelect || !clusterSelect) return;
  
  const selectedRegionId = parseInt(regionSelect.value);
  
  // Clear cluster options
  clusterSelect.innerHTML = '<option value="-1">No Cluster</option>';
  
  if (selectedRegionId === -1) {
    // If isolated, disable cluster dropdown
    clusterSelect.disabled = true;
    clusterSelect.value = '-1';
  } else {
    clusterSelect.disabled = false;
    
    // Add clusters for the selected region
    const regionStats = window.stateManager.getRegionStats();
    if (regionStats && regionStats.get(selectedRegionId)) {
      const clusters = Array.from(regionStats.get(selectedRegionId).clusters).sort((a, b) => a - b);
      clusters.forEach(communicationsClusterId => {
        const option = document.createElement('option');
        option.value = communicationsClusterId;
        option.textContent = `Cluster ${communicationsClusterId}`;
        clusterSelect.appendChild(option);
      });
      
      // Set current cluster selection if household is in this region
      if (!selectedHousehold.isIsolated && selectedHousehold.regionId === selectedRegionId) {
        clusterSelect.value = selectedHousehold.communicationsClusterId;
      }
    }
  }
}

window.updateClusterOptions = updateClusterOptions;

// Confirm household edits
function confirmHouseholdEdit() {
  if (!selectedHousehold) {
    console.error('No household selected for editing');
    return;
  }
  
  // Get all field values
  const basicInfo = {
    name: document.getElementById('edit-name')?.value.trim() || '',
    address: document.getElementById('edit-address')?.value.trim() || '',
    lat: parseFloat(document.getElementById('edit-lat')?.value || selectedHousehold.lat),
    lon: parseFloat(document.getElementById('edit-lon')?.value || selectedHousehold.lon),
    specialNeeds: document.getElementById('edit-special-needs')?.value.trim() || '',
    medicalSkills: document.getElementById('edit-medical-skills')?.value.trim() || '',
    recoverySkills: document.getElementById('edit-recovery-skills')?.value.trim() || '',
    recoveryEquipment: document.getElementById('edit-recovery-equipment')?.value.trim() || '',
    communicationSkillsAndEquipment: document.getElementById('edit-communication-skills-and-equipment')?.value.trim() || ''
  };
  
  // Get region/cluster values from dropdowns
  const selectedRegionId = parseInt(document.getElementById('edit-region').value);
  const selectedClusterId = parseInt(document.getElementById('edit-cluster').value);
  
  // Check if region assignment changed
  const regionChanged = (selectedRegionId !== selectedHousehold.regionId) || 
                       (selectedClusterId !== selectedHousehold.communicationsClusterId);
  
  // Check if basic info changed
  const basicInfoChanged = 
    basicInfo.name !== (selectedHousehold.name || '') ||
    basicInfo.address !== (selectedHousehold.address || '') ||
    (basicInfo.lat !== selectedHousehold.lat && !isNaN(basicInfo.lat)) ||
    (basicInfo.lon !== selectedHousehold.lon && !isNaN(basicInfo.lon)) ||
    basicInfo.specialNeeds !== (selectedHousehold.specialNeeds || '') ||
    basicInfo.medicalSkills !== (selectedHousehold.medicalSkills || '') ||
    basicInfo.recoverySkills !== (selectedHousehold.recoverySkills || '') ||
    basicInfo.recoveryEquipment !== (selectedHousehold.recoveryEquipment || '') ||
    basicInfo.communicationSkillsAndEquipment !== (selectedHousehold.communicationSkillsAndEquipment || '');
  
  if (!regionChanged && !basicInfoChanged) {
    closeHouseholdEditDialog();
    return;
  }
  
  // Prepare updates object
  const updates = {};
  
  // Add region changes if changed
  if (regionChanged) {
    const regionStats = window.stateManager.getRegionStats();
    const communicationsRegionName = selectedRegionId === -1 ? '' : 
      (regionStats.get(selectedRegionId) ? regionStats.get(selectedRegionId).name : `Region ${selectedRegionId}`);
    
    updates.regionId = selectedRegionId;
    updates.communicationsClusterId = selectedClusterId;
    updates.communicationsRegionName = communicationsRegionName;
  }
  
  // Add basic info changes if changed
  if (basicInfoChanged) {
    Object.assign(updates, basicInfo);
  }
  
  // Update StateManager once with all changes
  if (regionChanged || basicInfoChanged) {
    window.stateManager.updateHousehold(selectedHousehold.id, updates);
    // Also update local reference for UI purposes
    Object.assign(selectedHousehold, updates);
  }
  
  // Update marker if region changed
  if (regionChanged) {
    // Update marker appearance through MapManager
    window.mapManager.updateMarkerAfterChange(selectedHousehold);
  }
  
  // Always update popup to show new resources
  const marker = window.stateManager?.getMapMarker(selectedHousehold.id);
  if (marker) {
    window.mapManager.updateMarkerPopup(selectedHousehold, marker);
  }
  
  // If basic info changed, refresh resource discovery and filters
  if (basicInfoChanged) {
    // Update discovered resources
    window.stateManager.updateDiscoveredResources();
    
    // Rebuild resource filters
    window.resourceFilters.rebuild();
  }
  
  if (regionChanged) {
    window.mapManager.updateBoundaries();
    window.stateManager.notify('ui:changes:updated');
    window.householdList.rebuild();
  }
  
  window.dataLayer.saveToLocalStorage();
  closeHouseholdEditDialog();
  
  let msg = `Updated ${selectedHousehold?.name || 'household'}`;
  const changes = [];
  if (regionChanged) changes.push('region');
  if (basicInfoChanged) changes.push('info');
  
  if (changes.length > 0) {
    msg += ` (${changes.join(', ')})`;
  }
  window.statusManager.success(msg);
}

// Close household edit dialog
function closeHouseholdEditDialog() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('householdEditDialog').classList.remove('active');
  selectedHousehold = null;
}

// Show household selection dialog for co-located households
function showHouseholdSelectionDialog(households) {
  let dialogHtml = `
    <div class="dialog-header">
      <h3>Select Household to Edit</h3>
      <div class="household-info">Multiple households at this location</div>
    </div>
    
    <div class="household-options">
  `;
  
  households.forEach(household => {
    const assignment = household.isIsolated ? 'Isolated' : 
      `${household.communicationsRegionName}, Cluster ${household.communicationsClusterId}`;
    
    dialogHtml += `
      <div class="household-option" data-household-id="${household.id}">
        <div class="option-title">${household.name}</div>
        <div class="option-details">${assignment}</div>
      </div>
    `;
  });
  
  dialogHtml += `
    </div>
    <div class="dialog-buttons">
      <button class="btn btn-secondary" id="cancelSelectBtn">Cancel</button>
    </div>
  `;
  
  document.getElementById('householdEditDialog').innerHTML = dialogHtml;
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('householdEditDialog').classList.add('active');
}

// Select household for editing from co-located households
function selectHouseholdForEdit(householdId) {
  const household = window.stateManager ? window.stateManager.getHousehold(householdId) : null;
  if (household) {
    closeHouseholdEditDialog();
    openHouseholdEditDialog(household);
  }
}

// Load saved data (called by AppBootstrap)
async function loadSavedData() {
  try {
    const savedData = await window.dataLayer.loadFromLocalStorage();
    if (savedData && savedData.households.length > 0) {
      window.mapManager.createMapMarkers();
      window.mapManager.updateBoundaries();
    }
  } catch (error) {
    console.error('Error loading saved data:', error);
    window.statusManager.error('Error loading saved data');
  }
}

// Export loadSavedData for AppBootstrap
window.loadSavedData = loadSavedData;

window.openHouseholdEditDialog = openHouseholdEditDialog;
window.confirmHouseholdEdit = confirmHouseholdEdit;
window.closeHouseholdEditDialog = closeHouseholdEditDialog;
window.showHouseholdSelectionDialog = showHouseholdSelectionDialog;
window.selectHouseholdForEdit = selectHouseholdForEdit;

// Function to set household edit functions on EventManager (called by AppBootstrap)
window.setupHouseholdEditFunctions = function() {
  if (window.eventManager && window.openHouseholdEditDialog) {
    window.eventManager.setHouseholdEditFunctions(
      window.openHouseholdEditDialog,
      window.closeHouseholdEditDialog,
      window.confirmHouseholdEdit
    );
    return true;
  }
  return false;
};