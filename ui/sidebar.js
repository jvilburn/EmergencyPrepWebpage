// ui/sidebar.js - Sidebar navigation and collapse functionality

class Sidebar {
  constructor(stateManager) {
    this.state = stateManager;
    this.searchInput = null;
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.setupSearch();
    this.updateFooter();
    
    // Listen to state changes
    this.state.subscribe('households:loaded', () => {
      console.log('Sidebar: households:loaded event received');
      this.updateFooter();
    });
    this.state.subscribe('household:added', () => this.updateFooter());
    this.state.subscribe('household:deleted', () => this.updateFooter());
    this.state.subscribe('ui:filters:changed', () => this.updateFooter());
  }
  
  setupEventListeners() {
    // Hamburger menu toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => this.toggleHamburgerMenu());
    }
    
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => this.toggle());
    }
    
    // Sort buttons
    const nameBtn = document.getElementById('nameBtn');
    const regionBtn = document.getElementById('regionBtn');
    
    if (nameBtn) {
      nameBtn.addEventListener('click', () => this.setSortMode('name'));
    }
    
    if (regionBtn) {
      regionBtn.addEventListener('click', () => this.setSortMode('region'));
    }
    
    // Resource filters toggle (remove this - handled by onclick in HTML)
    // const resourceFiltersToggle = document.querySelector('.collapsible-header');
    // if (resourceFiltersToggle) {
    //   resourceFiltersToggle.addEventListener('click', () => this.toggleResourceFilters());
    // }
  }
  
  setupSearch() {
    this.searchInput = document.getElementById('searchInput');
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
      
      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.clearSearch();
        }
      });
    }
  }
  
  toggle() {
    const sidebar = document.getElementById('sidebar');
    const map = document.getElementById('map');
    
    if (!sidebar || !map) return;
    
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
      sidebar.classList.remove('collapsed');
      map.classList.remove('sidebar-collapsed');
    } else {
      sidebar.classList.add('collapsed');
      map.classList.add('sidebar-collapsed');
    }
    
    this.state.setSidebarCollapsed(!isCollapsed);
    
    // Update toggle button text
    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
      toggleBtn.textContent = isCollapsed ? '◀' : '▶';
    }
  }
  
  setSortMode(mode) {
    this.state.setSortMode(mode);
    this.updateSortButtons(mode);
    
    // Trigger household list rebuild
    this.state.notify('ui:sort:changed', mode);
  }
  
  updateSortButtons(activeMode) {
    const nameBtn = document.getElementById('nameBtn');
    const regionBtn = document.getElementById('regionBtn');
    
    if (nameBtn) {
      nameBtn.classList.toggle('active', activeMode === 'name');
    }
    
    if (regionBtn) {
      regionBtn.classList.toggle('active', activeMode === 'region');
    }
  }
  
  toggleResourceFilters() {
    const section = document.getElementById('resourceFiltersSection');
    const icon = document.getElementById('resourceFiltersIcon');
    
    if (!section || !icon) return;
    
    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
      section.classList.remove('collapsed');
      icon.textContent = '▼';
    } else {
      section.classList.add('collapsed');
      icon.textContent = '▶';
    }
  }
  
  toggleHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    if (!menu) {
      console.warn('Hamburger menu element not found');
      return;
    }
    
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
    
    // Close menu when clicking outside
    if (!isVisible) {
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && !e.target.classList.contains('hamburger-menu')) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      };
      
      setTimeout(() => {
        document.addEventListener('click', closeHandler);
      }, 100);
    }
  }
  
  closeHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    if (menu) {
      menu.style.display = 'none';
    }
  }
  
  handleSearch(query) {
    if (!query || !query.trim()) {
      this.clearSearch();
      return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    const householdItems = document.querySelectorAll('.household-item');
    
    householdItems.forEach(item => {
      const name = item.dataset.name?.toLowerCase() || '';
      const address = item.dataset.address?.toLowerCase() || '';
      const householdId = item.dataset.householdId;
      
      const household = this.state.getHousehold(householdId);
      const searchableText = [
        name,
        address,
        household?.specialNeeds?.toLowerCase(),
        household?.medicalSkills?.toLowerCase(),
        household?.recoverySkills?.toLowerCase(),
        household?.recoveryEquipment?.toLowerCase(),
        household?.communicationSkillsAndEquipment?.toLowerCase()
      ].filter(text => text).join(' ');
      
      const isMatch = searchableText.includes(searchTerm);
      
      // Show/hide household item
      item.style.display = isMatch ? '' : 'none';
      
      // Show/hide parent containers
      const parentGroup = item.closest('.cluster-group, .region-group, .isolated-group');
      if (parentGroup) {
        this.updateGroupVisibility(parentGroup);
      }
    });
    
    this.updateSearchStats(query);
  }
  
  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    
    // Show all items
    const householdItems = document.querySelectorAll('.household-item');
    householdItems.forEach(item => {
      item.style.display = '';
    });
    
    // Show all groups
    const groups = document.querySelectorAll('.cluster-group, .region-group, .isolated-group');
    groups.forEach(group => {
      group.style.display = '';
    });
    
    this.updateFooter();
  }
  
  updateGroupVisibility(group) {
    const visibleItems = group.querySelectorAll('.household-item:not([style*="display: none"])');
    group.style.display = visibleItems.length > 0 ? '' : 'none';
  }
  
  updateSearchStats(query) {
    const visibleItems = document.querySelectorAll('.household-item:not([style*="display: none"])');
    const footer = document.getElementById('sidebarFooter');
    
    if (footer) {
      const total = this.state.getAllHouseholds().length;
      footer.textContent = `${visibleItems.length} of ${total} households match "${query}"`;
    }
  }
  
  updateFooter() {
    const footer = document.getElementById('sidebarFooter');
    if (!footer) return;
    
    const stats = this.state.state.stats || this.calculateStats();
    const activeFilters = this.state.getActiveFilters();
    const hasFilters = Object.keys(activeFilters).length > 0;
    
    if (hasFilters) {
      // Show filter results
      const filteredHouseholds = window.dataLayer.filterByResources(new Map(Object.entries(activeFilters)));
      footer.textContent = `${filteredHouseholds.length} of ${stats.total} households match filters`;
    } else {
      // Show general stats
      footer.textContent = `${stats.total} households loaded`;
    }
  }
  
  calculateStats() {
    const households = this.state.getAllHouseholds();
    return {
      total: households.length,
      isolated: households.filter(h => h.isIsolated()).length,
      regions: this.state.getAllRegions().length
    };
  }
  
  // Public methods for external use
  collapse() {
    const sidebar = document.getElementById('sidebar');
    const map = document.getElementById('map');
    
    if (sidebar && map) {
      sidebar.classList.add('collapsed');
      map.classList.add('sidebar-collapsed');
      this.state.setSidebarCollapsed(true);
    }
  }
  
  expand() {
    const sidebar = document.getElementById('sidebar');
    const map = document.getElementById('map');
    
    if (sidebar && map) {
      sidebar.classList.remove('collapsed');
      map.classList.remove('sidebar-collapsed');
      this.state.setSidebarCollapsed(false);
    }
  }
  
  isCollapsed() {
    return this.state.isSidebarCollapsed();
  }
  
  getCurrentSortMode() {
    return this.state.getSortMode();
  }
}

// Sidebar will be created by AppBootstrap

