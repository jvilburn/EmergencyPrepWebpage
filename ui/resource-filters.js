// ui/resource-filters.js - Resource filtering functionality

class ResourceFilters {
  constructor(stateManager) {
    this.state = stateManager;
    this.container = null;
    this.init();
  }
  
  init() {
    this.container = document.getElementById('dynamicFiltersGrid');
    if (!this.container) {
      console.error('Resource filters container not found');
      return;
    }
    
    // Listen to state changes
    this.state.subscribe('households:loaded', () => this.rebuild());
    this.state.subscribe('resources:updated', () => this.rebuild());
    this.state.subscribe('household:updated', () => {
      // Resources will be updated by state manager, just rebuild the filters
      this.rebuild();
    });
    
    this.rebuild();
  }
  
  rebuild() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    
    const households = this.state.getAllHouseholds();
    if (households.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // Get discovered resources (already updated by state manager)
    const resources = this.state.getDiscoveredResources();
    
    this.buildSpecialNeedsFilter();
    this.buildMedicalSkillsFilters(resources.medicalSkills);
    this.buildRecoverySkillsFilters(resources.recoverySkills);
    this.buildRecoveryEquipmentFilters(resources.recoveryEquipment);
    this.buildCommunicationFilters(resources.communicationSkillsAndEquipment);
    this.buildClearButton();
  }
  
  showEmptyState() {
    this.container.innerHTML = `
      <div class="loading-filters">Load household data to see available filters</div>
    `;
  }
  
  buildSpecialNeedsFilter() {
    // Check if any households have special needs
    const hasSpecialNeeds = this.state.getAllHouseholds()
      .some(h => h.specialNeeds && h.specialNeeds.trim());
    
    if (!hasSpecialNeeds) return;
    
    const header = document.createElement('h5');
    header.textContent = 'Special Needs';
    header.style.gridColumn = 'span 2';
    header.style.marginBottom = '10px';
    this.container.appendChild(header);
    
    const label = this.createFilterItem({
      type: 'specialNeeds',
      field: 'hasSpecialNeeds',
      displayName: 'Has Special Needs'
    });
    
    this.container.appendChild(label);
  }
  
  buildMedicalSkillsFilters(medicalSkills) {
    if (!medicalSkills || medicalSkills.size === 0) return;
    
    const header = document.createElement('h5');
    header.textContent = 'Medical Skills';
    header.style.gridColumn = 'span 2';
    header.style.marginBottom = '10px';
    this.container.appendChild(header);
    
    Array.from(medicalSkills).sort().forEach(skill => {
      const label = this.createFilterItem({
        type: 'medicalSkill',
        field: skill,
        displayName: this.capitalizeFirst(skill)
      });
      
      this.container.appendChild(label);
    });
  }
  
  buildRecoverySkillsFilters(recoverySkills) {
    if (!recoverySkills || recoverySkills.size === 0) return;
    
    const header = document.createElement('h5');
    header.textContent = 'Recovery Skills';
    header.style.gridColumn = 'span 2';
    header.style.marginBottom = '10px';
    this.container.appendChild(header);
    
    Array.from(recoverySkills).sort().forEach(skill => {
      const label = this.createFilterItem({
        type: 'recoverySkill',
        field: skill,
        displayName: this.capitalizeFirst(skill)
      });
      
      this.container.appendChild(label);
    });
  }
  
  buildRecoveryEquipmentFilters(recoveryEquipment) {
    if (!recoveryEquipment || recoveryEquipment.size === 0) return;
    
    const header = document.createElement('h5');
    header.textContent = 'Recovery Equipment';
    header.style.gridColumn = 'span 2';
    header.style.marginBottom = '10px';
    this.container.appendChild(header);
    
    Array.from(recoveryEquipment).sort().forEach(equipment => {
      const label = this.createFilterItem({
        type: 'recoveryEquipment',
        field: equipment,
        displayName: this.capitalizeFirst(equipment)
      });
      
      this.container.appendChild(label);
    });
  }
  
  buildCommunicationFilters(communicationSkillsAndEquipment) {
    if (!communicationSkillsAndEquipment || communicationSkillsAndEquipment.size === 0) return;
    
    const header = document.createElement('h5');
    header.textContent = 'Communication Skills & Equipment';
    header.style.gridColumn = 'span 2';
    header.style.marginBottom = '10px';
    this.container.appendChild(header);
    
    Array.from(communicationSkillsAndEquipment).sort().forEach(item => {
      const label = this.createFilterItem({
        type: 'communicationSkillsAndEquipment',
        field: item,
        displayName: this.capitalizeFirst(item)
      });
      
      this.container.appendChild(label);
    });
  }
  
  buildClearButton() {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-filters-btn';
    clearBtn.textContent = 'Clear All';
    clearBtn.style.gridColumn = 'span 2';
    
    clearBtn.addEventListener('click', () => this.clearFilters());
    
    this.container.appendChild(clearBtn);
  }
  
  createFilterItem({ type, field, displayName }) {
    const label = document.createElement('label');
    label.className = 'resource-filter-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.type = type;
    checkbox.dataset.field = field;
    checkbox.addEventListener('change', () => this.applyFilters());
    
    const span = document.createElement('span');
    span.textContent = displayName;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    
    return label;
  }
  
  applyFilters() {
    const activeFilters = this.getActiveFilters();
    
    // Update state
    this.state.setActiveFilters(activeFilters);
    
    // Apply visual changes
    this.updateVisualEffects(activeFilters);
    
    // Notify other components
    this.state.notify('ui:filters:applied', activeFilters);
  }
  
  getActiveFilters() {
    const filters = {};
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]:checked');
    
    checkboxes.forEach(checkbox => {
      const type = checkbox.dataset.type;
      const field = checkbox.dataset.field;
      filters[`${type}:${field}`] = { type, field };
    });
    
    return filters;
  }
  
  updateVisualEffects(activeFilters) {
    const filterMap = new Map(
      Object.entries(activeFilters).map(([key, value]) => [value.type, value.field])
    );
    
    if (filterMap.size === 0) {
      this.clearVisualEffects();
      return;
    }
    
    // Filter households
    const filteredHouseholds = window.dataLayer.filterByResources(filterMap);
    const matchingIds = new Set(filteredHouseholds.map(h => h.id));
    
    // Update map markers
    this.updateMapMarkers(matchingIds);
    
    // Update sidebar items (handled by household-list)
    this.state.notify('ui:filters:changed', activeFilters);
  }
  
  updateMapMarkers(matchingIds) {
    const allHouseholds = this.state.getAllHouseholds();
    
    allHouseholds.forEach(household => {
      const marker = this.state.getMapMarker(household.id);
      const isMatch = matchingIds.has(household.id);
      
      if (marker) {
        if (isMatch) {
          // Highlight matching markers (Resource Filters style)
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
          const color = household.isIsolated() ? '#95a5a6' : 
                       this.getRegionColor(household.regionId);
          
          marker.setStyle({
            fillColor: color,
            radius: 6,
            weight: 1,
            opacity: 0.3,
            fillOpacity: 0.3
          });
        }
      }
    });
  }
  
  clearVisualEffects() {
    // Reset all markers to normal
    const allHouseholds = this.state.getAllHouseholds();
    
    allHouseholds.forEach(household => {
      const marker = this.state.getMapMarker(household.id);
      if (marker) {
        const color = household.isIsolated() ? '#95a5a6' : 
                     this.getRegionColor(household.regionId);
        
        marker.setStyle({
          fillColor: color,
          radius: 8,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        });
      }
    });
    
    // Clear resource-match classes (handled by household-list)
    document.querySelectorAll('.resource-match').forEach(el => {
      el.classList.remove('resource-match');
    });
  }
  
  clearFilters() {
    // Uncheck all checkboxes
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Clear state
    this.state.clearFilters();
    
    // Clear visual effects
    this.clearVisualEffects();
    
    // Notify other components
    this.state.notify('ui:filters:cleared');
  }
  
  // Helper methods
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  getRegionColor(regionId) {
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
    ];
    
    if (!regionId || regionId === 0) return '#95a5a6';
    
    return colors[(regionId - 1) % colors.length];
  }
  
  // Public API
  refresh() {
    this.rebuild();
  }
  
  hasActiveFilters() {
    return Object.keys(this.getActiveFilters()).length > 0;
  }
  
  getFilteredHouseholds() {
    const activeFilters = this.getActiveFilters();
    if (Object.keys(activeFilters).length === 0) {
      return this.state.getAllHouseholds();
    }
    
    const filterMap = new Map(
      Object.entries(activeFilters).map(([key, value]) => [value.type, value.field])
    );
    
    return window.dataLayer.filterByResources(filterMap);
  }
  
  setFilters(filters) {
    // Clear existing filters
    this.clearFilters();
    
    // Set new filters
    Object.entries(filters).forEach(([key, value]) => {
      const checkbox = this.container.querySelector(
        `input[data-type="${value.type}"][data-field="${value.field}"]`
      );
      if (checkbox) {
        checkbox.checked = true;
      }
    });
    
    // Apply the filters
    this.applyFilters();
  }
}

// ResourceFilters will be created by AppBootstrap