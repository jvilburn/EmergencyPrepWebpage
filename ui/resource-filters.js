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
    
    this.buildClearButton();
    this.buildSpecialNeedsFilter();
    this.buildMedicalSkillsFilters(resources.medicalSkills);
    this.buildCommunicationFilters(resources.communicationSkillsAndEquipment);
    this.buildRecoverySkillsFilters(resources.recoverySkills);
    this.buildRecoveryEquipmentFilters(resources.recoveryEquipment);
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
    
    const section = this.createCollapsibleSection('Special Needs', 'special-needs');
    
    const label = this.createFilterItem({
      type: 'specialNeeds',
      field: 'hasSpecialNeeds',
      displayName: 'Has Special Needs'
    });
    
    section.content.appendChild(label);
    this.container.appendChild(section.wrapper);
  }
  
  buildMedicalSkillsFilters(medicalSkills) {
    if (!medicalSkills || medicalSkills.size === 0) return;
    
    const section = this.createCollapsibleSection('Medical Skills', 'medical-skills');
    
    Array.from(medicalSkills).sort().forEach(skill => {
      const label = this.createFilterItem({
        type: 'medicalSkill',
        field: skill,
        displayName: this.capitalizeFirst(skill)
      });
      
      section.content.appendChild(label);
    });
    
    this.container.appendChild(section.wrapper);
  }
  
  buildRecoverySkillsFilters(recoverySkills) {
    if (!recoverySkills || recoverySkills.size === 0) return;
    
    const section = this.createCollapsibleSection('Recovery Skills', 'recovery-skills');
    
    Array.from(recoverySkills).sort().forEach(skill => {
      const label = this.createFilterItem({
        type: 'recoverySkill',
        field: skill,
        displayName: this.capitalizeFirst(skill)
      });
      
      section.content.appendChild(label);
    });
    
    this.container.appendChild(section.wrapper);
  }
  
  buildRecoveryEquipmentFilters(recoveryEquipment) {
    if (!recoveryEquipment || recoveryEquipment.size === 0) return;
    
    const section = this.createCollapsibleSection('Recovery Equipment', 'recovery-equipment');
    
    Array.from(recoveryEquipment).sort().forEach(equipment => {
      const label = this.createFilterItem({
        type: 'recoveryEquipment',
        field: equipment,
        displayName: this.capitalizeFirst(equipment)
      });
      
      section.content.appendChild(label);
    });
    
    this.container.appendChild(section.wrapper);
  }
  
  buildCommunicationFilters(communicationSkillsAndEquipment) {
    if (!communicationSkillsAndEquipment || communicationSkillsAndEquipment.size === 0) return;
    
    const section = this.createCollapsibleSection('Communication Skills & Equipment', 'communication-skills');
    
    Array.from(communicationSkillsAndEquipment).sort().forEach(item => {
      const label = this.createFilterItem({
        type: 'communicationSkillsAndEquipment',
        field: item,
        displayName: this.capitalizeFirst(item)
      });
      
      section.content.appendChild(label);
    });
    
    this.container.appendChild(section.wrapper);
  }
  
  buildClearButton() {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-filters-btn';
    clearBtn.textContent = 'Clear All';
    clearBtn.style.gridColumn = 'span 2';
    
    clearBtn.addEventListener('click', () => this.clearFilters());
    
    this.container.appendChild(clearBtn);
  }
  
  createCollapsibleSection(title, id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'resource-filter-section';
    wrapper.style.gridColumn = 'span 2';
    wrapper.style.marginBottom = '6px';
    
    const header = document.createElement('div');
    header.className = 'resource-filter-header';
    header.style.cursor = 'pointer';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '4px 0';
    header.style.borderBottom = '1px solid #dee2e6';
    header.style.marginBottom = '4px';
    
    const titleSpan = document.createElement('span');
    titleSpan.style.fontWeight = 'bold';
    titleSpan.style.fontSize = '14px';
    titleSpan.textContent = title;
    
    const icon = document.createElement('span');
    icon.className = 'expand-icon';
    icon.textContent = '▶';
    icon.style.fontSize = '12px';
    icon.style.color = '#6c757d';
    
    header.appendChild(titleSpan);
    header.appendChild(icon);
    
    const content = document.createElement('div');
    content.className = 'resource-filter-content collapsed';
    content.style.display = 'none';
    content.id = `${id}-content`;
    
    // Add toggle handler
    header.addEventListener('click', () => {
      const isCollapsed = content.classList.contains('collapsed');
      if (isCollapsed) {
        content.classList.remove('collapsed');
        content.style.display = 'block';
        icon.textContent = '▼';
      } else {
        content.classList.add('collapsed');
        content.style.display = 'none';
        icon.textContent = '▶';
      }
    });
    
    wrapper.appendChild(header);
    wrapper.appendChild(content);
    
    return { wrapper, header, content, icon };
  }

  createFilterItem({ type, field, displayName }) {
    const label = document.createElement('label');
    label.className = 'resource-filter-item';
    label.style.display = 'block';
    label.style.marginBottom = '3px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.type = type;
    checkbox.dataset.field = field;
    checkbox.addEventListener('change', () => this.applyFilters());
    
    const span = document.createElement('span');
    span.textContent = displayName;
    span.style.marginLeft = '8px';
    
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
    if (Object.keys(activeFilters).length === 0) {
      this.clearVisualEffects();
      return;
    }
    
    // Filter households - pass activeFilters object directly
    const filteredHouseholds = window.dataLayer.filterByResources(activeFilters);
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
    
    return window.dataLayer.filterByResources(activeFilters);
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