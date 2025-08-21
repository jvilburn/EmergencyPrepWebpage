// event-manager.js - Centralized HTML event handling

class EventManager {
  constructor(managers) {
    this.sidebar = managers.sidebar;
    this.uiManager = managers.uiManager;
    this.fileManager = managers.fileManager;
    this.mapManager = managers.mapManager;
    this.tileManager = managers.tileManager;
    this.regionClusterManager = managers.regionClusterManager;
    
    // Store references to household edit functions
    this.openHouseholdEditDialog = null;
    this.closeHouseholdEditDialog = null;
    this.confirmHouseholdEdit = null;
    
    this.init();
  }
  
  init() {
    this.setupHamburgerMenu();
    this.setupFileOperations();
    this.setupViewOperations();
    this.setupEditOperations();
    this.setupSortButtons();
    this.setupCollapsibleSections();
    this.setupModalDialogs();
  }
  
  setupHamburgerMenu() {
    const hamburgerBtn = document.querySelector('.hamburger-menu');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.sidebar.toggleHamburgerMenu();
      });
    } else {
      console.warn('Hamburger menu button not found');
    }
    
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    if (hamburgerMenu) {
      hamburgerMenu.addEventListener('click', (e) => e.stopPropagation());
      
      // Close menu when clicking outside
      document.addEventListener('click', () => this.sidebar.closeHamburgerMenu());
    } else {
      console.warn('Hamburger menu dropdown not found');
    }
  }
  
  
  setupFileOperations() {
    this.addMenuButtonListener('Load CSV', () => {
      this.fileManager.triggerFileLoad();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Save CSV', () => {
      this.fileManager.exportToCSV();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Export Missing Tiles', () => {
      this.tileManager.exportMissingTilesReport();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Check Missing Count', () => {
      this.tileManager.showMissingTilesCount();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Download Instructions', () => {
      this.tileManager.showDownloadInstructions();
      this.sidebar.closeHamburgerMenu();
    });
  }
  
  setupViewOperations() {
    this.addMenuButtonListener('Statistics', () => {
      this.uiManager.showStatistics();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Legend', () => {
      this.uiManager.showLegend();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Reset View', () => {
      this.mapManager.resetView();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Toggle Clusters', () => {
      this.mapManager.toggleClusters();
      this.sidebar.closeHamburgerMenu();
    });
  }
  
  setupEditOperations() {
    this.addMenuButtonListener('Manage Regions', () => {
      this.regionClusterManager.showRegionClusterPanel();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('View Changes', () => {
      this.uiManager.showChangeHistory();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Undo Last', () => {
      window.stateManager.undoLastChange();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Clear Highlights', () => {
      this.uiManager.clearHighlights();
      this.sidebar.closeHamburgerMenu();
    });
    
    this.addMenuButtonListener('Clear Missing Tiles', () => {
      this.tileManager.clearMissingTilesTracking();
      this.sidebar.closeHamburgerMenu();
    });
  }
  
  setupSortButtons() {
    const sortButtons = document.querySelectorAll('.sort-btn');
    sortButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = btn.textContent.includes('Name') ? 'name' : 'region';
        this.sidebar.setSortMode(mode);
      });
    });
  }
  
  setupCollapsibleSections() {
    // Find headers by their content to handle any ordering
    const allHeaders = document.querySelectorAll('.collapsible-header');
    
    allHeaders.forEach(header => {
      const headerText = header.querySelector('span').textContent;
      
      if (headerText.includes('Household List')) {
        header.addEventListener('click', () => this.toggleHouseholdList());
      } else if (headerText.includes('Resource Filters')) {
        header.addEventListener('click', () => this.toggleResourceFilters());
      }
    });
  }
  
  setupModalDialogs() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', () => {
        if (this.closeHouseholdEditDialog) {
          this.closeHouseholdEditDialog();
        }
      });
    }
    
    // Use event delegation for dynamic dialog buttons
    document.addEventListener('click', (e) => {
      this.handleDynamicButtonClick(e);
    });
  }
  
  // Helper methods
  addMenuButtonListener(buttonText, handler) {
    const button = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent.includes(buttonText)
    );
    if (button) {
      button.addEventListener('click', handler);
    }
  }
  
  toggleHouseholdList() {
    const section = document.getElementById('householdListSection');
    const icon = document.getElementById('householdListIcon');
    if (section) {
      const isCollapsed = section.classList.contains('collapsed');
      section.classList.toggle('collapsed');
      if (icon) {
        icon.textContent = isCollapsed ? '▼' : '▶';
      }
    }
  }
  
  toggleResourceFilters() {
    const section = document.getElementById('resourceFiltersSection');
    const icon = document.getElementById('resourceFiltersIcon');
    if (section) {
      const isCollapsed = section.classList.contains('collapsed');
      section.classList.toggle('collapsed');
      if (icon) {
        icon.textContent = isCollapsed ? '▶' : '▼';
      }
    }
  }
  
  // Handle dynamic button clicks from data-action attributes
  handleDynamicButtonClick(e) {
    const action = e.target.dataset.action;
    const buttonId = e.target.id;
    
    // Handle by ID even if no action attribute
    if (buttonId === 'cancelHouseholdBtn') {
      e.preventDefault();
      e.stopPropagation();
      if (this.closeHouseholdEditDialog) this.closeHouseholdEditDialog();
      return;
    }
    
    if (buttonId === 'confirmHouseholdBtn') {
      e.preventDefault();
      e.stopPropagation();
      if (this.confirmHouseholdEdit) this.confirmHouseholdEdit();
      return;
    }
    
    if (!action) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // App.js dialog actions
    if (action === 'cancel-household-edit') {
      if (this.closeHouseholdEditDialog) this.closeHouseholdEditDialog();
    } else if (action === 'confirm-household-edit' || e.target.id === 'confirmHouseholdBtn') {
      if (this.confirmHouseholdEdit) this.confirmHouseholdEdit();
    } else if (action === 'cancel-select' || e.target.id === 'cancelSelectBtn') {
      if (this.closeHouseholdEditDialog) this.closeHouseholdEditDialog();
    } else if (e.target.classList.contains('household-option')) {
      const householdId = e.target.dataset.householdId;
      if (householdId) {
        window.selectHouseholdForEdit(householdId);
      }
    }
    
    // Region/Cluster Manager actions
    else if (action === 'cancel-selection') {
      this.regionClusterManager.cancelSelection();
    } else if (action === 'apply-household-selection') {
      this.regionClusterManager.applyHouseholdSelection();
    } else if (action === 'apply-cluster-selection') {
      this.regionClusterManager.applyClusterSelection();
    } else if (action === 'close-region-panel') {
      document.getElementById('regionClusterPanel')?.remove();
    } else if (action === 'close-cluster-panel') {
      document.getElementById('clusterManagementPanel')?.remove();
    } else if (action === 'create-independent-cluster') {
      this.regionClusterManager.createIndependentCluster();
    } else if (action === 'create-region') {
      this.regionClusterManager.promptCreateRegion();
    } else if (action === 'rename-region') {
      const regionId = parseInt(e.target.dataset.regionId);
      this.regionClusterManager.promptRenameRegion(regionId);
    } else if (action === 'manage-clusters') {
      const regionId = parseInt(e.target.dataset.regionId);
      this.regionClusterManager.showRegionClusters(regionId);
    } else if (action === 'add-clusters') {
      const regionId = parseInt(e.target.dataset.regionId);
      this.regionClusterManager.startClusterSelection(regionId);
    } else if (action === 'delete-region') {
      const regionId = parseInt(e.target.dataset.regionId);
      this.regionClusterManager.confirmDeleteRegion(regionId);
    } else if (action === 'assign-cluster') {
      const regionId = parseInt(e.target.dataset.regionId);
      const clusterId = parseInt(e.target.dataset.clusterId);
      this.regionClusterManager.assignClusterToRegion(regionId, clusterId);
    } else if (action === 'add-households') {
      const regionId = parseInt(e.target.dataset.regionId);
      const clusterId = parseInt(e.target.dataset.clusterId);
      this.regionClusterManager.startHouseholdSelection(regionId, clusterId);
    } else if (action === 'zoom-cluster') {
      const regionId = parseInt(e.target.dataset.regionId);
      const clusterId = parseInt(e.target.dataset.clusterId);
      this.regionClusterManager.zoomToCluster(regionId, clusterId);
    } else if (action === 'delete-cluster') {
      const regionId = parseInt(e.target.dataset.regionId);
      const clusterId = parseInt(e.target.dataset.clusterId);
      this.regionClusterManager.confirmDeleteCluster(regionId, clusterId);
    } else if (action === 'create-cluster') {
      const regionId = parseInt(e.target.dataset.regionId);
      const regionName = e.target.dataset.regionName;
      this.regionClusterManager.promptCreateCluster(regionId, regionName);
    }
    
    // Map Manager actions
    else if (action === 'edit-household') {
      const householdId = e.target.dataset.householdId;
      if (householdId) {
        this.handleEditHousehold(householdId);
      }
    }
  }
  
  // Set household edit function references after they're available
  setHouseholdEditFunctions(openFn, closeFn, confirmFn) {
    this.openHouseholdEditDialog = openFn;
    this.closeHouseholdEditDialog = closeFn;
    this.confirmHouseholdEdit = confirmFn;
  }
  
  handleEditHousehold(householdId) {
    const household = window.stateManager?.getHousehold(householdId);
    if (household && this.openHouseholdEditDialog) {
      this.openHouseholdEditDialog(household);
    } else {
      console.error('Household edit dialog not available');
    }
  }
}