// electron-menu-handler.js - Handles menu events from Electron main process

class ElectronMenuHandler {
  constructor(fileManager, tileManager, sidebar, eventManager) {
    this.fileManager = fileManager;
    this.tileManager = tileManager;
    this.sidebar = sidebar;
    this.eventManager = eventManager;
    
    if (window.isElectron && window.electronAPI) {
      this.init();
    }
  }
  
  init() {
    // Register menu action listener
    window.electronAPI.onMenuAction((action) => {
      this.handleMenuAction(action);
    });
  }
  
  async handleMenuAction(action) {
    console.log('Menu action:', action);
    
    switch(action) {
      // File menu
      case 'load-csv':
        await this.loadCSV();
        break;
        
      case 'save-csv':
        await this.saveCSV();
        break;
        
      case 'save-csv-as':
        await this.saveCSVAs();
        break;
        
      case 'export-tiles':
        this.exportMissingTiles();
        break;
        
      // View menu
      case 'toggle-sidebar':
        this.toggleSidebar();
        break;
        
      case 'show-statistics':
        this.showStatistics();
        break;
        
      // Tools menu
      case 'check-tiles':
        this.checkMissingTiles();
        break;
        
      case 'download-tiles':
        this.downloadMissingTiles();
        break;
        
      case 'clear-tiles':
        this.clearMissingTiles();
        break;
        
      default:
        console.warn('Unknown menu action:', action);
    }
  }
  
  // File operations
  async loadCSV() {
    try {
      const fileData = await window.electronAPI.selectCSVFile();
      if (fileData) {
        await this.fileManager.loadFileFromElectron(fileData);
      }
    } catch (error) {
      console.error('Error loading CSV:', error);
      window.statusManager?.error('Failed to load CSV file');
    }
  }
  
  async saveCSV() {
    try {
      await this.fileManager.exportToCSV();
    } catch (error) {
      console.error('Error saving CSV:', error);
      window.statusManager?.error('Failed to save CSV file');
    }
  }
  
  async saveCSVAs() {
    try {
      // Force save with new filename
      await this.fileManager.exportToCSV(null);
    } catch (error) {
      console.error('Error saving CSV:', error);
      window.statusManager?.error('Failed to save CSV file');
    }
  }
  
  // Tile operations
  exportMissingTiles() {
    if (this.tileManager && this.tileManager.exportMissingTilesReport) {
      this.tileManager.exportMissingTilesReport();
    } else {
      // Fallback to event manager
      const exportBtn = document.querySelector('button[data-action="export-tiles"]');
      if (exportBtn) exportBtn.click();
    }
  }
  
  checkMissingTiles() {
    if (this.tileManager && this.tileManager.showMissingTilesCount) {
      this.tileManager.showMissingTilesCount();
    } else {
      // Fallback to event manager
      const checkBtn = document.querySelector('button[data-action="check-tiles"]');
      if (checkBtn) checkBtn.click();
    }
  }
  
  async downloadMissingTiles() {
    if (this.tileManager && this.tileManager.downloadMissingTiles) {
      // TODO: Implement native tile downloading
      alert('Tile downloading feature coming soon!\n\nFor now, use the Export Missing Tiles option and run the external tile downloader.');
    } else {
      alert('Tile downloading not yet implemented');
    }
  }
  
  clearMissingTiles() {
    if (this.tileManager && this.tileManager.clearMissingTilesTracking) {
      this.tileManager.clearMissingTilesTracking();
    }
  }
  
  // View operations
  toggleSidebar() {
    if (this.sidebar && this.sidebar.toggle) {
      this.sidebar.toggle();
    } else {
      // Fallback to direct DOM manipulation
      const toggleBtn = document.getElementById('sidebarToggle');
      if (toggleBtn) toggleBtn.click();
    }
  }
  
  showStatistics() {
    // Try event manager first
    if (this.eventManager) {
      const statsBtn = document.querySelector('button[data-action="statistics"]');
      if (statsBtn) {
        statsBtn.click();
        return;
      }
    }
    
    // Fallback to showing stats
    const stats = window.stateManager?.getStats();
    if (stats) {
      alert(`Ward Statistics:\n\nTotal Households: ${stats.total}\nRegions: ${stats.totalRegions}\nIsolated: ${stats.totalIsolated || 0}`);
    }
  }
  
  // Helper to remove File menu items from hamburger menu
  hideRedundantMenuItems() {
    // Hide file operations from hamburger menu since they're in native menu
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    if (!hamburgerMenu) return;
    
    // Find and hide Load CSV and Save CSV buttons
    const buttons = hamburgerMenu.querySelectorAll('button');
    buttons.forEach(btn => {
      const text = btn.textContent.toLowerCase();
      if (text.includes('load csv') || text.includes('save csv')) {
        btn.style.display = 'none';
      }
    });
    
    // Add a note about using File menu
    const fileSection = hamburgerMenu.querySelector('.menu-section');
    if (fileSection && !fileSection.querySelector('.menu-note')) {
      const note = document.createElement('div');
      note.className = 'menu-note';
      note.style.fontSize = '12px';
      note.style.color = '#6c757d';
      note.style.fontStyle = 'italic';
      note.style.padding = '5px';
      note.textContent = 'Use File menu for load/save operations';
      fileSection.insertBefore(note, fileSection.firstChild.nextSibling);
    }
  }
}

// Initialize when DOM is ready
if (window.isElectron) {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for app bootstrap to complete
    setTimeout(() => {
      const menuHandler = new ElectronMenuHandler(
        window.fileManager,
        window.tileManager,
        window.sidebar,
        window.eventManager
      );
      
      // Hide redundant menu items
      menuHandler.hideRedundantMenuItems();
      
      // Export for debugging
      window.electronMenuHandler = menuHandler;
    }, 100);
  });
}