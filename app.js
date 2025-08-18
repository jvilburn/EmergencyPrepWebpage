// app.js - Main application initialization and control

// Global application state
let editMode = false;

// Initialize application
window.addEventListener('DOMContentLoaded', function() {
  setupFileHandlers();
  initMap();
  checkOfflineStatus();
  loadSavedData();
  setStatus('Ready - Load your ward CSV file', 'info');
  buildHouseholdList();
});

// Setup file handlers
function setupFileHandlers() {
  const fileInput = document.getElementById('fileInput');
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      console.log('File input changed, files:', e.target.files.length);
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        console.log('Loading file:', file.name);
        loadFile(file);
        // Reset the input AFTER processing to allow reloading same file
        setTimeout(() => {
          e.target.value = '';
        }, 100);
      }
    });
  } else {
    console.error('File input element not found');
  }
  
  // Also allow drag and drop on the entire map
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    
    mapElement.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        loadFile(e.dataTransfer.files[0]);
      }
    });
  }
}

// Toggle edit mode
function toggleEditMode() {
  editMode = !editMode;
  window.editMode = editMode; // Expose to global scope
  
  const toggle = document.getElementById('editToggle');
  const indicator = document.getElementById('editIndicator');
  
  if (editMode) {
    toggle.classList.add('active');
    indicator.classList.add('active');
    if (window.map) {
      window.map.getContainer().style.cursor = 'pointer';
    }
  } else {
    toggle.classList.remove('active');
    indicator.classList.remove('active');
    if (window.map) {
      window.map.getContainer().style.cursor = '';
    }
  }
  
  // Update all marker popups to show/hide edit instructions
  if (window.wardData) {
    window.wardData.forEach(household => {
      const marker = window.markers[household.id];
      if (marker) {
        updateMarkerPopup(household, marker);
      }
    });
  }
  
  clearHighlights();
}

// Open reassignment dialog for household editing
function openReassignDialog(household) {
  selectedHousehold = household;
  selectedNewAssignment = null;
  
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
  
  if (window.regionStats) {
    Object.entries(window.regionStats).forEach(([regionId, region]) => {
      const selected = !household.isIsolated && household.regionId === parseInt(regionId) ? 'selected' : '';
      dialogHtml += `<option value="${regionId}" ${selected}>${region.name}</option>`;
    });
  }
  
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
      <button class="btn btn-secondary" onclick="closeReassignDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmReassignment()">Save Changes</button>
    </div>
  `;
  
  document.getElementById('reassignDialog').innerHTML = dialogHtml;
  
  // Initialize cluster options based on current region
  updateClusterOptions();
  
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('reassignDialog').classList.add('active');
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
    if (window.regionStats && window.regionStats[selectedRegionId]) {
      const clusters = Array.from(window.regionStats[selectedRegionId].clusters).sort((a, b) => a - b);
      clusters.forEach(clusterId => {
        const option = document.createElement('option');
        option.value = clusterId;
        option.textContent = `Cluster ${clusterId}`;
        clusterSelect.appendChild(option);
      });
      
      // Set current cluster selection if household is in this region
      if (!selectedHousehold.isIsolated && selectedHousehold.regionId === selectedRegionId) {
        clusterSelect.value = selectedHousehold.clusterId;
      }
    }
  }
}

// Make updateClusterOptions globally available
window.updateClusterOptions = updateClusterOptions;

// Confirm household edits
function confirmReassignment() {
  // Get all field values
  const basicInfo = {
    name: document.getElementById('edit-name').value.trim(),
    address: document.getElementById('edit-address').value.trim(),
    lat: parseFloat(document.getElementById('edit-lat').value),
    lon: parseFloat(document.getElementById('edit-lon').value),
    specialNeeds: document.getElementById('edit-special-needs').value.trim(),
    medicalSkills: document.getElementById('edit-medical-skills').value.trim(),
    recoverySkills: document.getElementById('edit-recovery-skills').value.trim(),
    recoveryEquipment: document.getElementById('edit-recovery-equipment').value.trim(),
    communicationSkillsAndEquipment: document.getElementById('edit-communication-skills-and-equipment').value.trim()
  };
  
  // Get region/cluster values from dropdowns
  const selectedRegionId = parseInt(document.getElementById('edit-region').value);
  const selectedClusterId = parseInt(document.getElementById('edit-cluster').value);
  
  // Check if region assignment changed
  const regionChanged = (selectedRegionId !== selectedHousehold.regionId) || 
                       (selectedClusterId !== selectedHousehold.clusterId);
  
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
    closeReassignDialog();
    return;
  }
  
  // Update household assignment if changed
  if (regionChanged) {
    const regionName = selectedRegionId === -1 ? '' : 
      (window.regionStats[selectedRegionId] ? window.regionStats[selectedRegionId].name : `Region ${selectedRegionId}`);
    
    const newAssignment = {
      regionId: selectedRegionId,
      clusterId: selectedClusterId,
      regionName: regionName
    };
    
    updateHouseholdAssignment(selectedHousehold, newAssignment);
  }
  
  // Update basic information
  if (basicInfoChanged) {
    updateHouseholdResources(selectedHousehold, basicInfo);
  }
  
  // Update marker if region changed
  if (regionChanged) {
    updateMarkerAfterChange(selectedHousehold);
  }
  
  // Always update popup to show new resources
  const marker = window.markers[selectedHousehold.id];
  updateMarkerPopup(selectedHousehold, marker);
  
  // If basic info changed, refresh resource discovery and filters
  if (basicInfoChanged) {
    if (window.updateDiscoveredResources) {
      window.updateDiscoveredResources();
    }
    if (window.buildResourceFilters) {
      window.buildResourceFilters();
    }
  }
  
  if (regionChanged) {
    recalculateStatistics();
    updateBoundaries();
    updateChangesCounter();
    buildHouseholdList();
  }
  
  saveDataLocally();
  closeReassignDialog();
  
  let msg = `Updated ${selectedHousehold.name}`;
  const changes = [];
  if (regionChanged) changes.push('region');
  if (basicInfoChanged) changes.push('info');
  
  if (changes.length > 0) {
    msg += ` (${changes.join(', ')})`;
  }
  setStatus(msg, 'success');
}

// Close reassignment dialog
function closeReassignDialog() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('reassignDialog').classList.remove('active');
  selectedHousehold = null;
  selectedNewAssignment = null;
}

// Show household selection dialog for co-located households
function showHouseholdSelectionDialog(households) {
  let dialogHtml = `
    <div class="dialog-header">
      <h3>Select Household to Edit</h3>
      <div class="household-info">Multiple households at this location</div>
    </div>
    
    <div class="reassign-options">
  `;
  
  households.forEach(household => {
    const assignment = household.isIsolated ? 'Isolated' : 
      `${household.regionName}, Cluster ${household.clusterId}`;
    
    dialogHtml += `
      <div class="reassign-option" onclick="selectHouseholdForEdit('${household.id}')">
        <div class="option-title">${household.name}</div>
        <div class="option-details">${assignment}</div>
      </div>
    `;
  });
  
  dialogHtml += `
    </div>
    <div class="dialog-buttons">
      <button class="btn btn-secondary" onclick="closeReassignDialog()">Cancel</button>
    </div>
  `;
  
  document.getElementById('reassignDialog').innerHTML = dialogHtml;
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('reassignDialog').classList.add('active');
}

// Select household for editing from co-located households
function selectHouseholdForEdit(householdId) {
  const household = window.wardData.find(h => h.id === householdId);
  if (household) {
    closeReassignDialog();
    setTimeout(() => openReassignDialog(household), 100);
  }
}

// Expose global functions and state
window.editMode = editMode;
window.selectedHousehold = selectedHousehold;
window.selectedNewAssignment = selectedNewAssignment;
window.toggleEditMode = toggleEditMode;
window.openReassignDialog = openReassignDialog;
window.selectReassignment = selectReassignment;
window.confirmReassignment = confirmReassignment;
window.closeReassignDialog = closeReassignDialog;
window.showHouseholdSelectionDialog = showHouseholdSelectionDialog;
window.selectHouseholdForEdit = selectHouseholdForEdit;

// Export the main action functions to global scope for HTML onclick handlers
window.resetView = resetView;
window.clearHighlights = clearHighlights;
window.toggleClusters = toggleClusters;
window.viewChanges = viewChanges;
window.undoLastChange = undoLastChange;
window.exportData = exportData;