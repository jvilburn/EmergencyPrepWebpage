// app-bootstrap.js - Application initialization in proper dependency order

class AppBootstrap {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      
      // Phase 1: Core Foundation
      this.createFoundationLayer();
      
      // Phase 2: Data Layer  
      this.createDataLayer();
      
      // Phase 3: UI Components
      await this.createUIComponents();
      
      // Phase 4: Map and Managers
      this.createMapManagers();
      
      // Phase 5: Region/Cluster Management
      this.createRegionManagement();
      
      // Phase 6: Final Setup
      await this.finalizeInitialization();
      
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  }
  
  createFoundationLayer() {
    // Foundation classes are already created by their respective scripts
    if (!window.stateManager || !window.statusManager) {
      throw new Error('Foundation layer not ready');
    }
  }
  
  createDataLayer() {
    // DataLayer is already created by its script
    if (!window.dataLayer) {
      throw new Error('DataLayer not ready');
    }
  }
  
  async createUIComponents() {
    // Create UI components in dependency order
    window.sidebar = new Sidebar(window.stateManager);
    window.householdList = new HouseholdList(window.stateManager);
    window.resourceFilters = new ResourceFilters(window.stateManager);
    window.highlightingManager = new HighlightingManager(window.stateManager);
    
    // Create UIManager (depends on other UI components)
    window.uiManager = new UIManager(window.stateManager);
    
    if (!window.uiManager) {
      throw new Error('UIManager creation failed');
    }
    
  }
  
  createMapManagers() {
    // Create MapManager and TileManager
    window.mapManager = new MapManager(window.stateManager, window.statusManager);
    window.tileManager = new TileManager(window.mapManager, window.statusManager);
    window.tileManager.integrateWithMapManager(window.mapManager);
    
    // Create FileManager
    window.fileManager = new FileManager(
      window.stateManager,
      window.dataLayer,
      window.statusManager,
      window.mapManager
    );
    
  }
  
  createRegionManagement() {
    // Create RegionClusterManager with all dependencies
    window.regionClusterManager = new RegionClusterManager(
      window.stateManager,
      window.statusManager, 
      window.uiManager,
      window.dataLayer,
      window.householdList,
      window.mapManager
    );
    
  }
  
  async finalizeInitialization() {
    // Initialize map first
    await window.mapManager.initMap();
    
    // Load saved data if available (after map is ready)
    if (window.loadSavedData) {
      await window.loadSavedData();
    }
    
    // Create EventManager for HTML event handling
    window.eventManager = new EventManager({
      sidebar: window.sidebar,
      uiManager: window.uiManager,
      fileManager: window.fileManager,
      mapManager: window.mapManager,
      tileManager: window.tileManager,
      regionClusterManager: window.regionClusterManager
    });
    
    // Set household edit functions now that EventManager exists
    if (window.setupHouseholdEditFunctions) {
      window.setupHouseholdEditFunctions();
    }
    
  }
  
  // Error recovery
  static handleInitializationError(error) {
    console.error('Failed to initialize application:', error);
    
    // Show user-friendly error message
    const statusBar = document.getElementById('statusMessage');
    if (statusBar) {
      statusBar.textContent = 'Application failed to load. Please refresh the page.';
      statusBar.style.color = 'red';
    }
  }
}

// Global bootstrap function
window.initializeApp = async function() {
  const bootstrap = new AppBootstrap();
  try {
    await bootstrap.initialize();
  } catch (error) {
    AppBootstrap.handleInitializationError(error);
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.initializeApp();
});