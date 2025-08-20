// ui.js - User interface interactions and sidebar management

// Global UI state
let sortMode = 'name';
let sidebarCollapsed = false;
let highlightedItems = new Set();
let selectedHousehold = null;
let selectedNewAssignment = null;

// Toggle sidebar collapse
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const mapEl = document.getElementById('map');
  const controls = document.getElementById('controls');
  const quickActions = document.getElementById('quickActions');
  const toggle = sidebar.querySelector('.sidebar-toggle');
  
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    mapEl.classList.add('sidebar-collapsed');
    controls.classList.add('sidebar-collapsed');
    quickActions.classList.add('sidebar-collapsed');
    toggle.innerHTML = '▶';
  } else {
    sidebar.classList.remove('collapsed');
    mapEl.classList.remove('sidebar-collapsed');
    controls.classList.remove('sidebar-collapsed');
    quickActions.classList.remove('sidebar-collapsed');
    toggle.innerHTML = '◀';
  }
  
  setTimeout(() => {
    if (window.map) {
      window.map.invalidateSize();
    }
  }, 300);
}

// Set sort mode for household list
function setSortMode(mode) {
  sortMode = mode;
  
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase().includes(mode)) {
      btn.classList.add('active');
    }
  });
  
  buildHouseholdList();
}

// Filter households based on search term
function filterHouseholds() {
  const searchTerm = document.getElementById('searchBox').value.toLowerCase();
  const items = document.querySelectorAll('.household-item, .cluster-header, .region-header');
  
  if (searchTerm === '') {
    items.forEach(item => {
      item.style.display = '';
    });
    document.querySelectorAll('.region-group, .cluster-group').forEach(group => {
      group.style.display = '';
    });
  } else {
    let visibleRegions = new Set();
    let visibleClusters = new Set();
    
    document.querySelectorAll('.household-item').forEach(item => {
      const name = item.dataset.name.toLowerCase();
      const address = item.dataset.address ? item.dataset.address.toLowerCase() : '';
      
      if (name.includes(searchTerm) || address.includes(searchTerm)) {
        item.style.display = '';
        if (item.dataset.regionId) visibleRegions.add(item.dataset.regionId);
        if (item.dataset.clusterId) visibleClusters.add(item.dataset.clusterId);
      } else {
        item.style.display = 'none';
      }
    });
    
    document.querySelectorAll('.region-group').forEach(group => {
      if (visibleRegions.has(group.dataset.regionId)) {
        group.style.display = '';
      } else {
        group.style.display = 'none';
      }
    });
    
    document.querySelectorAll('.cluster-group').forEach(group => {
      if (visibleClusters.has(group.dataset.clusterId)) {
        group.style.display = '';
      } else {
        group.style.display = 'none';
      }
    });
  }
}

// Toggle resource filters panel
function toggleResourceFilters() {
  const panel = document.getElementById('resourceFilters');
  panel.classList.toggle('collapsed');
}

// Build dynamic resource filters based on discovered resources
function buildResourceFilters() {
  console.log('buildResourceFilters called');
  const filtersGrid = document.getElementById('dynamicFiltersGrid');
  if (!filtersGrid) {
    console.log('dynamicFiltersGrid element not found');
    return;
  }
  
  filtersGrid.innerHTML = '';
  
  // Check if we have any resources at all
  const hasMedicalSkills = window.discoveredMedicalSkills && window.discoveredMedicalSkills.size > 0;
  const hasRecoverySkills = window.discoveredRecoverySkills && window.discoveredRecoverySkills.size > 0;
  const hasRecoveryEquipment = window.discoveredRecoveryEquipment && window.discoveredRecoveryEquipment.size > 0;
  const hasCommSkillsAndEquipment = window.discoveredCommunicationSkillsAndEquipment && window.discoveredCommunicationSkillsAndEquipment.size > 0;
  
  // Check for special needs
  const hasSpecialNeeds = window.wardData && window.wardData.some(h => h.specialNeeds && h.specialNeeds.trim());
  
  if (!hasMedicalSkills && !hasRecoverySkills && !hasRecoveryEquipment && !hasCommSkillsAndEquipment && !hasSpecialNeeds) {
    filtersGrid.innerHTML = '<div class="loading-filters">No resources found in household data</div>';
    return;
  }
  
  // Special Needs section
  if (hasSpecialNeeds) {
    const header = document.createElement('h5');
    header.textContent = 'Special Needs';
    header.style.gridColumn = 'span 2';
    header.style.margin = '8px 0 4px 0';
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    filtersGrid.appendChild(header);
    
    const label = document.createElement('label');
    label.className = 'resource-filter-item';
    label.innerHTML = `
      <input type="checkbox" onchange="applyResourceFilters()" data-type="specialNeeds" data-field="hasSpecialNeeds"> 
      Has Special Needs
    `;
    filtersGrid.appendChild(label);
  }
  
  // Medical Skills section
  if (window.discoveredMedicalSkills && window.discoveredMedicalSkills.size > 0) {
    const header = document.createElement('h5');
    header.textContent = 'Medical Skills';
    header.style.gridColumn = 'span 2';
    header.style.margin = '8px 0 4px 0';
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    filtersGrid.appendChild(header);
    
    Array.from(window.discoveredMedicalSkills).sort().forEach(skill => {
      const label = document.createElement('label');
      label.className = 'resource-filter-item';
      label.innerHTML = `
        <input type="checkbox" onchange="applyResourceFilters()" data-type="medicalSkill" data-field="${skill}"> 
        ${skill.charAt(0).toUpperCase() + skill.slice(1)}
      `;
      filtersGrid.appendChild(label);
    });
  }
  
  // Recovery Skills section
  if (window.discoveredRecoverySkills && window.discoveredRecoverySkills.size > 0) {
    const header = document.createElement('h5');
    header.textContent = 'Recovery Skills';
    header.style.gridColumn = 'span 2';
    header.style.margin = '8px 0 4px 0';
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    filtersGrid.appendChild(header);
    
    Array.from(window.discoveredRecoverySkills).sort().forEach(skill => {
      const label = document.createElement('label');
      label.className = 'resource-filter-item';
      label.innerHTML = `
        <input type="checkbox" onchange="applyResourceFilters()" data-type="recoverySkill" data-field="${skill}"> 
        ${skill.charAt(0).toUpperCase() + skill.slice(1)}
      `;
      filtersGrid.appendChild(label);
    });
  }
  
  // Recovery Equipment section
  if (window.discoveredRecoveryEquipment && window.discoveredRecoveryEquipment.size > 0) {
    const header = document.createElement('h5');
    header.textContent = 'Recovery Equipment';
    header.style.gridColumn = 'span 2';
    header.style.margin = '8px 0 4px 0';
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    filtersGrid.appendChild(header);
    
    Array.from(window.discoveredRecoveryEquipment).sort().forEach(equipment => {
      const label = document.createElement('label');
      label.className = 'resource-filter-item';
      label.innerHTML = `
        <input type="checkbox" onchange="applyResourceFilters()" data-type="recoveryEquipment" data-field="${equipment}"> 
        ${equipment.charAt(0).toUpperCase() + equipment.slice(1)}
      `;
      filtersGrid.appendChild(label);
    });
  }
  
  // Communication Skills and Equipment section (combined)
  if (window.discoveredCommunicationSkillsAndEquipment && window.discoveredCommunicationSkillsAndEquipment.size > 0) {
    const header = document.createElement('h5');
    header.textContent = 'Communication Skills & Equipment';
    header.style.gridColumn = 'span 2';
    header.style.margin = '8px 0 4px 0';
    header.style.fontSize = '14px';
    header.style.fontWeight = 'bold';
    filtersGrid.appendChild(header);
    
    Array.from(window.discoveredCommunicationSkillsAndEquipment).sort().forEach(item => {
      const label = document.createElement('label');
      label.className = 'resource-filter-item';
      label.innerHTML = `
        <input type="checkbox" onchange="applyResourceFilters()" data-type="communicationSkillsAndEquipment" data-field="${item}"> 
        ${item.charAt(0).toUpperCase() + item.slice(1)}
      `;
      filtersGrid.appendChild(label);
    });
  }
  
  // Clear all button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'clear-filters-btn';
  clearBtn.textContent = 'Clear All';
  clearBtn.style.gridColumn = 'span 2';
  clearBtn.onclick = clearResourceFilters;
  filtersGrid.appendChild(clearBtn);
}

// Apply resource filters
function applyResourceFilters() {
  if (!window.wardData || window.wardData.length === 0) {
    console.log('No ward data loaded yet');
    return;
  }
  
  const activeFilters = [];
  document.querySelectorAll('.resource-filter-item input:checked').forEach(checkbox => {
    activeFilters.push({
      type: checkbox.dataset.type,
      field: checkbox.dataset.field
    });
  });
  
  console.log('Active filters:', activeFilters);
  
  // Clear previous highlights
  document.querySelectorAll('.resource-match').forEach(el => {
    el.classList.remove('resource-match');
  });
  
  if (activeFilters.length === 0) {
    // Reset all markers to normal
    window.wardData.forEach(household => {
      const marker = window.markers[household.id];
      if (marker) {
        const color = household.isIsolated ? '#95a5a6' : 
                     COLORS[(household.regionId - 1) % COLORS.length];
        marker.setStyle({
          fillColor: color,
          radius: 8,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });
      }
    });
    updateSidebarFooter();
    return;
  }
  
  // Find matching households
  let matchCount = 0;
  const matchingIds = new Set();
  
  window.wardData.forEach(household => {
    let matches = false;
    
    for (const filter of activeFilters) {
      if (filter.type === 'specialNeeds') {
        if (household.specialNeeds && household.specialNeeds.trim()) {
          matches = true;
          console.log(`${household.name} has special needs: ${household.specialNeeds}`);
          break;
        }
      } else if (filter.type === 'medicalSkill') {
        if (household.medicalSkills && household.medicalSkills.toLowerCase().includes(filter.field.toLowerCase())) {
          matches = true;
          console.log(`${household.name} has medical skill: ${filter.field}`);
          break;
        }
      } else if (filter.type === 'recoverySkill') {
        if (household.recoverySkills && household.recoverySkills.toLowerCase().includes(filter.field.toLowerCase())) {
          matches = true;
          console.log(`${household.name} has recovery skill: ${filter.field}`);
          break;
        }
      } else if (filter.type === 'recoveryEquipment') {
        if (household.recoveryEquipment && household.recoveryEquipment.toLowerCase().includes(filter.field.toLowerCase())) {
          matches = true;
          console.log(`${household.name} has recovery equipment: ${filter.field}`);
          break;
        }
      } else if (filter.type === 'communicationSkillsAndEquipment') {
        if (household.communicationSkillsAndEquipment && household.communicationSkillsAndEquipment.toLowerCase().includes(filter.field.toLowerCase())) {
          matches = true;
          console.log(`${household.name} has communication skills/equipment: ${filter.field}`);
          break;
        }
      }
    }
    
    if (matches) {
      matchCount++;
      matchingIds.add(household.id);
    }
  });
  
  // Apply visual changes to all households
  window.wardData.forEach(household => {
    const marker = window.markers[household.id];
    const isMatch = matchingIds.has(household.id);
    
    if (marker) {
      if (isMatch) {
        // Highlight matching markers
        marker.setStyle({
          radius: 12,
          weight: 4,
          opacity: 1,
          fillOpacity: 1,
          fillColor: '#28a745'  // Green for matches
        });
        // Bring to front
        if (marker.bringToFront) {
          marker.bringToFront();
        }
      } else {
        // Dim non-matching markers
        const color = household.isIsolated ? '#95a5a6' : 
                     COLORS[(household.regionId - 1) % COLORS.length];
        marker.setStyle({
          fillColor: color,
          radius: 6,
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0.3
        });
      }
    }
    
    // Highlight list items
    const listItems = document.querySelectorAll(`[data-household-id="${household.id}"]`);
    listItems.forEach(item => {
      if (isMatch) {
        item.classList.add('resource-match');
      } else {
        item.classList.remove('resource-match');
      }
    });
  });
  
  // Update footer with match count
  const footer = document.getElementById('sidebarFooter');
  if (footer) {
    const total = window.wardData.length;
    footer.textContent = `${matchCount} of ${total} households match filters`;
  }
  console.log(`Found ${matchCount} matches out of ${window.wardData.length} households`);
}

// ===== NEW INTERFACE FUNCTIONS =====

// Toggle hamburger menu
window.toggleHamburgerMenu = function() {
  console.log('Toggle hamburger menu called');
  const menu = document.getElementById('hamburgerMenu');
  if (menu) {
    menu.classList.toggle('show');
    console.log('Menu classes:', menu.className);
  } else {
    console.error('Hamburger menu element not found');
  }
}

// Close hamburger menu when clicking outside
document.addEventListener('click', function(e) {
  const menu = document.getElementById('hamburgerMenu');
  const hamburgerBtn = document.querySelector('.hamburger-menu');
  
  if (menu && !menu.contains(e.target) && hamburgerBtn && !hamburgerBtn.contains(e.target)) {
    menu.classList.remove('show');
  }
});

// Toggle household list section
window.toggleHouseholdList = function() {
  const content = document.getElementById('householdListSection');
  const icon = document.getElementById('householdListIcon');
  
  if (content && icon) {
    content.classList.toggle('collapsed');
    icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
    
    // If opening and list is empty, rebuild it
    if (!content.classList.contains('collapsed')) {
      const listContainer = document.getElementById('householdList');
      if (listContainer && (!listContainer.innerHTML || listContainer.innerHTML.includes('No households loaded'))) {
        if (window.wardData && window.wardData.length > 0) {
          window.buildHouseholdList();
        }
      }
    }
  }
}

// Update resource filters toggle to work with new structure
window.toggleResourceFilters = function() {
  const content = document.getElementById('resourceFiltersSection');
  const icon = document.getElementById('resourceFiltersIcon');
  
  if (content && icon) {
    content.classList.toggle('collapsed');
    icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
  }
}

// Trigger file load from menu
window.triggerFileLoad = function() {
  // Close menu first, before opening file dialog
  const menu = document.getElementById('hamburgerMenu');
  if (menu) {
    menu.classList.remove('show');
  }
  
  // Small delay to let menu close before opening file dialog
  setTimeout(() => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.click();
    }
  }, 100);
}

// setStatus is already defined in utils.js, no need to duplicate here

// Clear resource filters
function clearResourceFilters() {
  document.querySelectorAll('.resource-filter-item input').forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Remove all highlights
  document.querySelectorAll('.resource-match').forEach(el => {
    el.classList.remove('resource-match');
  });
  
  // Reset all markers
  if (window.wardData) {
    window.wardData.forEach(household => {
    const marker = window.markers[household.id];
    if (marker) {
      const color = household.isIsolated ? '#95a5a6' : 
                   COLORS[(household.regionId - 1) % COLORS.length];
      marker.setStyle({
        fillColor: color,
        radius: 8,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      });
    }
    });
  }
  
  updateSidebarFooter();
}

// Update sidebar footer
function updateSidebarFooter() {
  const footer = document.getElementById('sidebarFooter');
  if (!footer) return;
  
  const total = window.wardData ? window.wardData.length : 0;
  const modified = window.wardData ? window.wardData.filter(h => 
    h.originalRegionId !== h.regionId || 
    h.originalClusterId !== h.clusterId
  ).length : 0;
  
  let text = `${total} households`;
  if (modified > 0) {
    text += ` • ${modified} modified`;
  }
  
  footer.textContent = text;
}

// Build household list in sidebar
function buildHouseholdList() {
  const listContainer = document.getElementById('householdList');
  if (!listContainer) {
    console.error('Household list container not found');
    return;
  }
  
  listContainer.innerHTML = '';
  
  // Use window.wardData to ensure we're accessing the global variable
  if (!window.wardData || window.wardData.length === 0) {
    listContainer.innerHTML = '<li style="padding: 20px; text-align: center; color: #6c757d;">No households loaded.<br>Load a CSV file to begin.</li>';
    updateSidebarFooter();
    return;
  }
  
  console.log(`Building household list with ${window.wardData.length} households, sort mode: ${sortMode}`);
  
  if (sortMode === 'name') {
    buildListByName(listContainer);
  } else {
    buildListByRegion(listContainer);
  }
  
  updateSidebarFooter();
}

// Build list sorted by name
function buildListByName(container) {
  console.log('buildListByName called');
  
  const sortedHouseholds = [...window.wardData].sort((a, b) => 
    a.name.localeCompare(b.name)
  );
  
  console.log(`Processing ${sortedHouseholds.length} households`);
  
  sortedHouseholds.forEach((household, index) => {
    console.log(`Creating household item ${index + 1}/${sortedHouseholds.length}: ${household.name} (ID: ${household.id})`);
    
    
    const li = document.createElement('li');
    li.className = 'household-item';
    if (household.isIsolated) li.classList.add('isolated');
    if (household.originalRegionId !== household.regionId || 
        household.originalClusterId !== household.clusterId) {
      li.classList.add('modified');
    }
    
    li.dataset.householdId = household.id;
    li.dataset.name = household.name;
    li.dataset.address = household.address || '';
    
    const assignment = household.isIsolated ? 
      'Isolated' : 
      `R${household.regionId}-C${household.clusterId}`;
    
    li.innerHTML = `
      <span>${household.name}</span>
      <span style="font-size: 11px; color: #6c757d;">${assignment}</span>
    `;
    
    // Simplified click handler
    li.addEventListener('click', (event) => {
      console.log('Household item clicked, ID:', household.id);
      console.log('About to call highlightHousehold...');
      
      try {
        console.log('About to call highlightHouseholdInUI with ID:', household.id);
        
        // Call our UI highlighting function directly
        highlightHouseholdInUI(household.id);
        console.log('highlightHouseholdInUI completed successfully');
      } catch (error) {
        console.error('Error calling highlightHouseholdInUI:', error);
        console.error('Error stack:', error.stack);
      }
      
      event.stopPropagation();
      event.preventDefault();
    });
    
    console.log(`Added onclick handler for household ${household.name} (${household.id})`);
    container.appendChild(li);
    
    // Verify the element was added and has the right attributes
    console.log('Added element:', li);
    console.log('Element dataset:', li.dataset);
    console.log('Element classes:', li.className);
  });
}

// Build list grouped by region
function buildListByRegion(container) {
  const organized = {};
  const isolated = [];
  
  window.wardData.forEach(household => {
    if (household.isIsolated) {
      isolated.push(household);
    } else {
      const regionKey = household.regionId;
      if (!organized[regionKey]) {
        organized[regionKey] = {
          name: household.regionName || 'Region ' + regionKey,
          clusters: {}
        };
      }
      
      const clusterKey = household.clusterId;
      if (!organized[regionKey].clusters[clusterKey]) {
        organized[regionKey].clusters[clusterKey] = [];
      }
      
      organized[regionKey].clusters[clusterKey].push(household);
    }
  });
  
  const sortedRegions = Object.keys(organized).sort((a, b) => parseInt(a) - parseInt(b));
  
  sortedRegions.forEach(regionId => {
    const region = organized[regionId];
    const regionGroup = document.createElement('li');
    regionGroup.className = 'region-group';
    regionGroup.dataset.regionId = regionId;
    
    const regionHeader = document.createElement('div');
    regionHeader.className = 'region-header';
    regionHeader.dataset.regionId = regionId;
    
    const regionColor = COLORS[(parseInt(regionId) - 1) % COLORS.length];
    const householdCount = Object.values(region.clusters).reduce((sum, cluster) => 
      sum + cluster.length, 0
    );
    
    regionHeader.innerHTML = `
      <div>
        <span class="region-color" style="background: ${regionColor};"></span>
        <span>${region.name}</span>
        <span class="region-count">(${householdCount})</span>
      </div>
      <span class="expand-icon">▼</span>
    `;
    
    regionHeader.onclick = (e) => {
      if (e.target.closest('.expand-icon')) {
        regionGroup.classList.toggle('collapsed');
      } else {
        highlightRegion(regionId);
      }
    };
    
    regionGroup.appendChild(regionHeader);
    
    const sortedClusters = Object.keys(region.clusters).sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedClusters.forEach(clusterId => {
      const clusterHouseholds = region.clusters[clusterId];
      const clusterGroup = document.createElement('div');
      clusterGroup.className = 'cluster-group';
      clusterGroup.dataset.clusterId = `${regionId}-${clusterId}`;
      
      const clusterHeader = document.createElement('div');
      clusterHeader.className = 'cluster-header';
      clusterHeader.dataset.clusterId = `${regionId}-${clusterId}`;
      
      clusterHeader.innerHTML = `
        <div>
          <span style="margin-left: 20px;">Cluster ${clusterId}</span>
          <span class="region-count">(${clusterHouseholds.length})</span>
        </div>
        <span class="expand-icon">▼</span>
      `;
      
      clusterHeader.onclick = (e) => {
        if (e.target.closest('.expand-icon')) {
          clusterGroup.classList.toggle('collapsed');
        } else {
          highlightCluster(regionId, clusterId);
        }
      };
      
      clusterGroup.appendChild(clusterHeader);
      
      clusterHouseholds.sort((a, b) => a.name.localeCompare(b.name)).forEach(household => {
        const householdItem = document.createElement('div');
        householdItem.className = 'household-item';
        if (household.originalRegionId !== household.regionId || 
            household.originalClusterId !== household.clusterId) {
          householdItem.classList.add('modified');
        }
        
        householdItem.dataset.householdId = household.id;
        householdItem.dataset.name = household.name;
        householdItem.dataset.address = household.address || '';
        householdItem.dataset.regionId = regionId;
        householdItem.dataset.clusterId = `${regionId}-${clusterId}`;
        
        householdItem.innerHTML = `<span>${household.name}</span>`;
        householdItem.addEventListener('click', (event) => {
          console.log('Cluster household item clicked, ID:', household.id);
          try {
            highlightHouseholdInUI(household.id);
          } catch (error) {
            console.error('Error in cluster highlight:', error);
          }
          event.stopPropagation();
        });
        
        console.log(`Added onclick handler for cluster household ${household.name} (${household.id})`);
        clusterGroup.appendChild(householdItem);
      });
      
      regionGroup.appendChild(clusterGroup);
    });
    
    container.appendChild(regionGroup);
  });
  
  if (isolated.length > 0) {
    const isolatedGroup = document.createElement('li');
    isolatedGroup.className = 'region-group';
    isolatedGroup.dataset.regionId = 'isolated';
    
    const isolatedHeader = document.createElement('div');
    isolatedHeader.className = 'region-header';
    isolatedHeader.innerHTML = `
      <div>
        <span class="region-color" style="background: #95a5a6;"></span>
        <span>Isolated Households</span>
        <span class="region-count">(${isolated.length})</span>
      </div>
      <span class="expand-icon">▼</span>
    `;
    
    isolatedHeader.onclick = (e) => {
      if (e.target.closest('.expand-icon')) {
        isolatedGroup.classList.toggle('collapsed');
      }
    };
    
    isolatedGroup.appendChild(isolatedHeader);
    
    isolated.sort((a, b) => a.name.localeCompare(b.name)).forEach(household => {
      const householdItem = document.createElement('div');
      householdItem.className = 'household-item isolated';
      if (household.originalRegionId !== household.regionId || 
          household.originalClusterId !== household.clusterId) {
        householdItem.classList.add('modified');
      }
      
      householdItem.dataset.householdId = household.id;
      householdItem.dataset.name = household.name;
      householdItem.dataset.address = household.address || '';
      
      householdItem.innerHTML = `<span>${household.name}</span>`;
      householdItem.addEventListener('click', (event) => {
        console.log('Isolated household item clicked, ID:', household.id);
        try {
          highlightHouseholdInUI(household.id);
        } catch (error) {
          console.error('Error in isolated highlight:', error);
        }
        event.stopPropagation();
      });
      
      console.log(`Added onclick handler for isolated household ${household.name} (${household.id})`);
      isolatedGroup.appendChild(householdItem);
    });
    
    container.appendChild(isolatedGroup);
  }
}

// Dim all households (reduces opacity for all markers)
function dimAllHouseholds() {
  console.log('dimAllHouseholds: Starting...');
  
  if (!window.markers) {
    console.log('dimAllHouseholds: No markers available');
    return;
  }
  
  console.log('dimAllHouseholds: Processing', Object.keys(window.markers).length, 'markers');
  
  Object.keys(window.markers).forEach(householdId => {
    const marker = window.markers[householdId];
    if (marker) {
      // Store original styles if not already stored
      if (!marker._originalStyles) {
        marker._originalStyles = {
          radius: marker.options.radius,
          weight: marker.options.weight,
          opacity: marker.options.opacity,
          fillOpacity: marker.options.fillOpacity
        };
      }
      
      // Dim the marker using Resource Filters style
      marker.setStyle({
        radius: 6,
        weight: 1,
        opacity: 0.3,
        fillOpacity: 0.3
      });
    }
  });
}

// Restore all households to normal opacity
function restoreAllHouseholds() {
  if (!window.markers) return;
  
  Object.keys(window.markers).forEach(householdId => {
    const marker = window.markers[householdId];
    if (marker && marker._originalStyles) {
      marker.setStyle(marker._originalStyles);
      delete marker._originalStyles;
    } else if (marker) {
      // Fallback to default styles
      marker.setStyle({
        radius: 8,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });
    }
  });
}

// Highlight individual household in UI
function highlightHouseholdInUI(householdId) {
  console.log('=== highlightHouseholdInUI FUNCTION START ===');
  console.log('highlightHouseholdInUI called with ID:', householdId);
  console.log('Type of householdId:', typeof householdId);
  
  try {
    clearHighlights();
    console.log('clearHighlights completed');
  } catch (error) {
    console.error('Error in clearHighlights:', error);
    return;
  }
  
  const household = window.wardData.find(h => h.id === householdId);
  if (!household) {
    console.log('ERROR: Household not found for ID:', householdId);
    return;
  }
  console.log('Found household:', household.name);
  
  // First dim all households
  console.log('Calling dimAllHouseholds...');
  dimAllHouseholds();
  console.log('dimAllHouseholds completed');
  
  // Add class to sidebar to enable dimming styles
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.add('has-highlights');
    console.log('Added has-highlights class to sidebar');
    console.log('Sidebar classes:', sidebar.className);
    
    // Force update all household items immediately with inline styles as backup
    const allItems = sidebar.querySelectorAll('.household-item');
    console.log(`Found ${allItems.length} household items in sidebar`);
    
    allItems.forEach((item, index) => {
      const itemId = item.dataset.householdId;
      console.log(`Item ${index}: ID=${itemId}, Selected=${itemId === householdId}`);
      
      if (!itemId || itemId !== householdId) {
        // This is not the highlighted item, dim it
        console.log(`Dimming item ${index} (${itemId})`);
        item.style.opacity = '0.4';
        item.style.color = '#999';
        item.style.transition = 'opacity 0.2s, color 0.2s';
        item.style.background = '';
        
        // Verify styles were applied
        const computedStyles = window.getComputedStyle(item);
        console.log(`Applied dim styles to ${itemId}: opacity=${computedStyles.opacity}, color=${computedStyles.color}`);
      } else {
        console.log(`NOT dimming selected item ${index} (${itemId})`);
      }
    });
  } else {
    console.log('Sidebar element not found');
  }
  
  const marker = window.markers[householdId];
  if (marker) {
    // Apply highlight styles using Resource Filters style (green highlight)
    marker.setStyle({
      radius: 12,
      weight: 4,
      opacity: 1,
      fillOpacity: 1,
      fillColor: '#28a745'  // Green for highlighted household
    });
    
    // Bring to front like Resource Filters do
    if (marker.bringToFront) {
      marker.bringToFront();
    }
    
    highlightedItems.add(householdId);
  }
  
  // Find and highlight all instances of this household in the sidebar
  const listItems = document.querySelectorAll(`[data-household-id="${householdId}"]`);
  console.log(`Looking for items with data-household-id="${householdId}"`);
  console.log(`Found ${listItems.length} household items to highlight`);
  
  if (listItems.length === 0) {
    console.log('WARNING: No items found to highlight! Checking all items in sidebar...');
    const allItems = document.querySelectorAll('.household-item');
    console.log(`Total household items in DOM: ${allItems.length}`);
    allItems.forEach((item, idx) => {
      console.log(`Item ${idx}: data-household-id="${item.dataset.householdId}"`);
    });
  }
  
  listItems.forEach((listItem, index) => {
    console.log(`Highlighting item ${index}:`, listItem);
    console.log(`Item current styles before: opacity=${listItem.style.opacity}, background=${listItem.style.background}`);
    
    listItem.classList.add('highlighted');
    
    // Also force highlight styles inline as backup
    listItem.style.background = '#ffeaa7 !important';
    listItem.style.borderLeft = '4px solid #fdcb6e';
    listItem.style.fontWeight = '600';
    listItem.style.opacity = '1 !important';
    listItem.style.boxShadow = '0 2px 4px rgba(253, 203, 110, 0.3)';
    listItem.style.color = '#333 !important';
    
    console.log(`Item styles after: opacity=${listItem.style.opacity}, background=${listItem.style.background}`);
    console.log('Item classes after adding highlighted:', listItem.className);
    
    // Check computed styles
    const computed = window.getComputedStyle(listItem);
    console.log(`Computed styles: opacity=${computed.opacity}, background=${computed.backgroundColor}, color=${computed.color}`);
  });
  
  // No scrolling - keep current sidebar position like Resource Filters
  
  // Debug: Check all household items and their classes
  const allHouseholdItems = document.querySelectorAll('.household-item');
  console.log(`Total household items in sidebar: ${allHouseholdItems.length}`);
  allHouseholdItems.forEach((item, index) => {
    console.log(`Item ${index} - ID: ${item.dataset.householdId}, Classes: ${item.className}`);
  });
  
  // Open edit dialog if in edit mode
  if (window.editMode && window.openReassignDialog) {
    window.openReassignDialog(household);
  }
}

// Highlight region
function highlightRegion(regionId) {
  clearHighlights();
  
  const regionHouseholds = window.wardData.filter(h => 
    !h.isIsolated && h.regionId === parseInt(regionId)
  );
  
  // First dim all households
  dimAllHouseholds();
  
  // Add class to sidebar to enable dimming styles
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.add('has-highlights');
  }
  
  const bounds = [];
  regionHouseholds.forEach(household => {
    const marker = window.markers[household.id];
    if (marker) {
      // Apply highlight styles (overriding the dimmed state)
      marker.setStyle({
        radius: 10,
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      });
      
      highlightedItems.add(household.id);
      bounds.push([household.lat, household.lon]);
      
      // Also highlight in sidebar
      const listItems = document.querySelectorAll(`[data-household-id="${household.id}"]`);
      listItems.forEach(listItem => {
        listItem.classList.add('highlighted');
      });
    }
  });
  
  if (bounds.length > 0 && window.map) {
    window.map.fitBounds(bounds, { padding: [50, 50] });
  }
  
  const regionHeader = document.querySelector(`.region-header[data-region-id="${regionId}"]`);
  if (regionHeader) {
    regionHeader.classList.add('highlighted');
    regionHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  highlightedItems.add(`region-${regionId}`);
}

// Highlight cluster
function highlightCluster(regionId, clusterId) {
  clearHighlights();
  
  const clusterHouseholds = window.wardData.filter(h => 
    !h.isIsolated && 
    h.regionId === parseInt(regionId) && 
    h.clusterId === parseInt(clusterId)
  );
  
  // First dim all households
  dimAllHouseholds();
  
  // Add class to sidebar to enable dimming styles
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.add('has-highlights');
  }
  
  const bounds = [];
  clusterHouseholds.forEach(household => {
    const marker = window.markers[household.id];
    if (marker) {
      // Apply highlight styles (overriding the dimmed state)
      marker.setStyle({
        radius: 10,
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      });
      
      highlightedItems.add(household.id);
      bounds.push([household.lat, household.lon]);
      
      // Also highlight in sidebar
      const listItems = document.querySelectorAll(`[data-household-id="${household.id}"]`);
      listItems.forEach(listItem => {
        listItem.classList.add('highlighted');
      });
    }
  });
  
  if (bounds.length > 0 && window.map) {
    window.map.fitBounds(bounds, { padding: [50, 50] });
  }
  
  const clusterHeader = document.querySelector(`.cluster-header[data-cluster-id="${regionId}-${clusterId}"]`);
  if (clusterHeader) {
    clusterHeader.classList.add('highlighted');
    clusterHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  highlightedItems.add(`cluster-${regionId}-${clusterId}`);
}

// Clear all highlights
function clearHighlights() {
  console.log('clearHighlights called');
  
  // Restore all households to normal state
  restoreAllHouseholds();
  
  // Remove highlight class from sidebar
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('has-highlights');
    console.log('Removed has-highlights class from sidebar');
  }
  
  // Clear sidebar highlights
  const highlightedElements = document.querySelectorAll('.highlighted');
  console.log(`Found ${highlightedElements.length} highlighted elements to clear`);
  
  highlightedElements.forEach(item => {
    console.log('Removing highlighted class from:', item);
    item.classList.remove('highlighted');
    
    // Clear inline styles
    item.style.background = '';
    item.style.borderLeft = '';
    item.style.fontWeight = '';
    item.style.opacity = '';
    item.style.boxShadow = '';
    item.style.color = '';
    item.style.transition = '';
  });
  
  // Also clear any inline styles from all household items
  const allHouseholdItems = document.querySelectorAll('.household-item');
  allHouseholdItems.forEach(item => {
    item.style.opacity = '';
    item.style.color = '';
    item.style.transition = '';
    item.style.background = '';
    item.style.borderLeft = '';
    item.style.fontWeight = '';
    item.style.boxShadow = '';
  });
  
  highlightedItems.clear();
}

// Show statistics panel
function showStatistics() {
  const total = window.wardData ? window.wardData.length : 0;
  const isolated = window.wardData ? window.wardData.filter(h => h.isIsolated).length : 0;
  const regions = window.regionStats ? Object.keys(window.regionStats).length : 0;
  
  const statsText = `Statistics:\n` +
    `Total Households: ${total}\n` +
    `Regions: ${regions}\n` +
    `Isolated: ${isolated}\n` +
    `In Regions: ${total - isolated}`;
  
  alert(statsText);
}

// Show legend panel
function showLegend() {
  if (!window.regionStats) {
    alert('No region data available');
    return;
  }
  
  const sortedRegions = Object.entries(window.regionStats).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  let legendText = 'Region Legend:\n\n';
  
  sortedRegions.forEach(([regionId, region]) => {
    legendText += `● ${region.name} (${region.count} households)\n`;
  });
  
  const isolated = window.wardData ? window.wardData.filter(h => h.isIsolated).length : 0;
  if (isolated > 0) {
    legendText += `● Isolated (${isolated} households)\n`;
  }
  
  alert(legendText);
}

// Update changes counter (updated for new interface)
function updateChangesCounter() {
  // Update the new status bar changes indicator
  const changesIndicator = document.getElementById('changesIndicator');
  if (changesIndicator && window.changes) {
    if (window.changes.length > 0) {
      changesIndicator.textContent = `📝 ${window.changes.length} change${window.changes.length !== 1 ? 's' : ''}`;
      changesIndicator.classList.remove('hidden');
    } else {
      changesIndicator.classList.add('hidden');
    }
  }
  
  // Old elements don't exist anymore, so skip them
}

// Expose global variables and functions
window.highlightedItems = highlightedItems;
window.toggleSidebar = toggleSidebar;
window.setSortMode = setSortMode;
window.filterHouseholds = filterHouseholds;
window.toggleResourceFilters = toggleResourceFilters;
window.applyResourceFilters = applyResourceFilters;
window.clearResourceFilters = clearResourceFilters;
window.updateSidebarFooter = updateSidebarFooter;
window.buildHouseholdList = buildHouseholdList;
window.highlightHouseholdInUI = highlightHouseholdInUI;
window.highlightHousehold = highlightHouseholdInUI; // Keep backward compatibility
window.highlightRegion = highlightRegion;
window.highlightCluster = highlightCluster;
window.clearHighlights = clearHighlights;
window.showStatistics = showStatistics;
window.showLegend = showLegend;
window.updateChangesCounter = updateChangesCounter;
window.buildResourceFilters = buildResourceFilters;