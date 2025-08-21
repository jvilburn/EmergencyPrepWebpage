// ui/highlighting.js - Visual highlighting system

class HighlightingManager {
  constructor(stateManager) {
    this.state = stateManager;
    this.init();
  }
  
  init() {
    // Listen to state changes
    this.state.subscribe('ui:highlight:cleared', () => this.clearHighlightsUI());
    this.state.subscribe('households:loaded', () => this.clearHighlightsUI());
  }
  
  // Household highlighting
  highlightHousehold(householdId) {
    this.clearHighlightsUI();
    
    const household = this.state.getHousehold(householdId);
    if (!household) return;
    
    // Dim all households first
    this.dimAllHouseholds();
    this.dimSidebarItems(householdId);
    
    // Highlight the selected household on map
    this.highlightMapMarker(householdId);
    
    // Highlight the selected household in sidebar
    this.highlightSidebarItems(householdId);
    
    // Update state
    this.state.addHighlightedItem(householdId);
  }
  
  // Region highlighting  
  highlightRegion(communicationsRegionName) {
    this.clearHighlightsUI();
    
    const regionHouseholds = this.state.getHouseholdsByRegion(communicationsRegionName);
    if (regionHouseholds.length === 0) return;
    
    // Dim all households first
    this.dimAllHouseholds();
    this.dimSidebarItems();
    
    // Highlight region households
    const householdIds = regionHouseholds.map(h => h.id);
    householdIds.forEach(id => {
      this.highlightMapMarker(id);
      this.highlightSidebarItems(id);
    });
    
    // Highlight region header
    this.highlightRegionHeader(communicationsRegionName);
    
    // Fit map to region bounds
    this.fitMapToHouseholds(regionHouseholds);
    
    // Update state
    this.state.setHighlightedItems([...householdIds, `region-${communicationsRegionName}`]);
  }
  
  // Cluster highlighting
  highlightCluster(regionId, communicationsClusterId) {
    this.clearHighlightsUI();
    
    const clusterHouseholds = this.state.getHouseholdsByCluster(
      parseInt(regionId), 
      parseInt(communicationsClusterId)
    );
    if (clusterHouseholds.length === 0) return;
    
    // Dim all households first
    this.dimAllHouseholds();
    this.dimSidebarItems();
    
    // Highlight cluster households
    const householdIds = clusterHouseholds.map(h => h.id);
    householdIds.forEach(id => {
      this.highlightMapMarker(id);
      this.highlightSidebarItems(id);
    });
    
    // Highlight cluster header
    this.highlightClusterHeader(regionId, communicationsClusterId);
    
    // Fit map to cluster bounds
    this.fitMapToHouseholds(clusterHouseholds);
    
    // Update state
    this.state.setHighlightedItems([...householdIds, `cluster-${regionId}-${communicationsClusterId}`]);
  }
  
  // Clear all highlights (public API - includes state clearing)
  clearHighlights() {
    // Restore UI elements
    this.clearHighlightsUI();
    
    // Clear state
    this.state.clearHighlights();
  }
  
  // Clear only UI elements (internal method - no state clearing)
  clearHighlightsUI() {
    // Check if resource filters are active before restoring markers
    const activeFilters = this.state.getActiveFilters();
    const hasResourceFilters = Object.keys(activeFilters).length > 0;
    
    if (hasResourceFilters) {
      // Only restore markers that aren't affected by resource filters
      this.restoreMarkersPreservingResourceFilters();
    } else {
      // Restore all map markers normally
      this.restoreAllMapMarkers();
    }
    
    // Restore sidebar items
    this.restoreSidebarItems();
  }
  
  // Map marker operations
  highlightMapMarker(householdId) {
    const marker = this.state.getMapMarker(householdId);
    if (!marker) return;
    
    // Apply highlight styles (Resource Filters style - green highlight)
    marker.setStyle({
      radius: 12,
      weight: 4,
      opacity: 1,
      fillOpacity: 1,
      fillColor: '#28a745'  // Green for highlighted household
    });
    
    // Bring to front
    if (marker.bringToFront) {
      marker.bringToFront();
    }
  }
  
  dimAllHouseholds() {
    const allMarkers = this.state.getAllMapMarkers();
    
    allMarkers.forEach((marker, householdId) => {
      if (marker) {
        // Store original styles if not already stored
        if (!marker._originalStyles) {
          marker._originalStyles = {
            radius: marker.options.radius,
            weight: marker.options.weight,
            opacity: marker.options.opacity,
            fillOpacity: marker.options.fillOpacity,
            fillColor: marker.options.fillColor
          };
        }
        
        // Dim the marker (Resource Filters style)
        marker.setStyle({
          radius: 6,
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0.3
        });
      }
    });
  }
  
  restoreAllMapMarkers() {
    const allMarkers = this.state.getAllMapMarkers();
    
    allMarkers.forEach((marker, householdId) => {
      if (marker) {
        if (marker._originalStyles) {
          marker.setStyle(marker._originalStyles);
          delete marker._originalStyles;
        } else {
          // Fallback to default styles
          const household = this.state.getHousehold(householdId);
          const color = household?.isIsolated() ? '#95a5a6' : 
                       this.getRegionColor(household?.regionId);
          
          marker.setStyle({
            radius: 8,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
            fillColor: color
          });
        }
      }
    });
  }

  restoreMarkersPreservingResourceFilters() {
    // When resource filters are active, let the resource filter system handle marker styling
    // Just clean up any _originalStyles and trigger resource filter reapplication
    const allMarkers = this.state.getAllMapMarkers();
    
    allMarkers.forEach((marker, householdId) => {
      if (marker && marker._originalStyles) {
        // Clean up original styles but don't restore them
        delete marker._originalStyles;
      }
    });
    
    // Trigger resource filter system to reapply its styling
    if (window.resourceFilters) {
      const activeFilters = this.state.getActiveFilters();
      window.resourceFilters.updateVisualEffects(activeFilters);
    }
  }
  
  // Sidebar operations
  highlightSidebarItems(householdId) {
    const listItems = document.querySelectorAll(`[data-household-id="${householdId}"]`);
    listItems.forEach(listItem => {
      listItem.classList.add('highlighted');
      
      // Force highlight styles (Resource Filters style)
      listItem.style.background = '#d4edda';
      listItem.style.borderLeft = '3px solid #28a745';
      listItem.style.fontWeight = 'bold';
      listItem.style.opacity = '1';
      listItem.style.color = '#333';
    });
  }
  
  dimSidebarItems(excludeHouseholdId = null) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    sidebar.classList.add('has-highlights');
    
    // Dim all household items
    const allItems = sidebar.querySelectorAll('.household-item');
    allItems.forEach(item => {
      const itemId = item.dataset.householdId;
      if (!excludeHouseholdId || itemId !== excludeHouseholdId) {
        // This is not the highlighted item, dim it
        item.style.opacity = '0.4';
        item.style.color = '#999';
        item.style.transition = 'opacity 0.2s, color 0.2s';
        item.style.background = '';
      }
    });
  }
  
  restoreSidebarItems() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('has-highlights');
    }
    
    // Clear highlighted elements
    const highlightedElements = document.querySelectorAll('.highlighted');
    highlightedElements.forEach(item => {
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
    
    // Clear styles from all household items
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
  }
  
  // Header highlighting
  highlightRegionHeader(regionId) {
    const regionHeader = document.querySelector(`.region-header[data-region-id="${regionId}"]`);
    if (regionHeader) {
      regionHeader.classList.add('highlighted');
    }
  }
  
  highlightClusterHeader(regionId, communicationsClusterId) {
    const clusterHeader = document.querySelector(`.cluster-header[data-cluster-id="${regionId}-${communicationsClusterId}"]`);
    if (clusterHeader) {
      clusterHeader.classList.add('highlighted');
    }
  }
  
  // Map bounds operations
  fitMapToHouseholds(households) {
    if (!households || households.length === 0 || !window.map) return;
    
    const bounds = households.map(h => [h.lat, h.lon]);
    if (bounds.length === 1) {
      // Single household - center map without changing zoom
      window.map.setView(bounds[0]);
    } else {
      // Multiple households - fit bounds
      window.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
  
  // Utility methods
  getRegionColor(regionId) {
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
    ];
    
    if (!regionId || regionId === 0) return '#95a5a6';
    
    return colors[(regionId - 1) % colors.length];
  }
  
  isHighlighted(item) {
    return this.state.isHighlighted(item);
  }
  
  getHighlightedItems() {
    return this.state.getHighlightedItems();
  }
  
  // Public API for external use
  highlightHouseholds(householdIds) {
    this.clearHighlightsUI();
    
    if (!householdIds || householdIds.length === 0) return;
    
    // Dim all first
    this.dimAllHouseholds();
    this.dimSidebarItems();
    
    // Highlight selected
    householdIds.forEach(id => {
      this.highlightMapMarker(id);
      this.highlightSidebarItems(id);
    });
    
    // Fit map to households
    const households = householdIds.map(id => this.state.getHousehold(id)).filter(h => h);
    this.fitMapToHouseholds(households);
    
    // Update state
    this.state.setHighlightedItems(householdIds);
  }
  
  toggleHighlight(householdId) {
    if (this.isHighlighted(householdId)) {
      this.clearHighlights();
    } else {
      this.highlightHousehold(householdId);
    }
  }
}

// HighlightingManager will be created by AppBootstrap