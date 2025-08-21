// file-manager.js - File operations and CSV import/export management

class FileManager {
  constructor(stateManager, dataLayer, statusManager, mapManager) {
    this.state = stateManager;
    this.dataLayer = dataLayer;
    this.status = statusManager;
    this.mapManager = mapManager;
    
    // File input element
    this.fileInput = null;
    
    // Supported file types
    this.supportedTypes = {
      csv: {
        extensions: ['.csv'],
        mimeTypes: ['text/csv', 'application/csv'],
        description: 'CSV (Comma-separated values)'
      }
    };
    
    this.init();
  }
  
  init() {
    this.setupFileInput();
    this.setupDragAndDrop();
  }
  
  // File input setup
  setupFileInput() {
    this.fileInput = document.getElementById('fileInput');
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.loadFile(e.target.files[0]);
        }
      });
    }
  }
  
  // Drag and drop setup
  setupDragAndDrop() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      mapContainer.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });
    
    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
      mapContainer.addEventListener(eventName, () => this.highlight(mapContainer), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      mapContainer.addEventListener(eventName, () => this.unhighlight(mapContainer), false);
    });
    
    // Handle dropped files
    mapContainer.addEventListener('drop', (e) => this.handleDrop(e), false);
  }
  
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  highlight(element) {
    element.classList.add('drag-over');
  }
  
  unhighlight(element) {
    element.classList.remove('drag-over');
  }
  
  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      this.loadFile(files[0]);
    }
  }
  
  // File validation
  validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }
    
    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = this.supportedTypes.csv.extensions.some(ext => 
      fileName.endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: `Please select a CSV file. Supported formats: ${this.supportedTypes.csv.extensions.join(', ')}` 
      };
    }
    
    // Check file size (limit to 10MB for safety)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB` 
      };
    }
    
    return { valid: true };
  }
  
  // Main file loading method
  async loadFile(file) {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      this.status.error(validation.error);
      return null;
    }
    
    this.status.info(`Loading ${file.name}...`);
    
    try {
      // Read file content
      const text = await this.readFileAsText(file);
      
      // Import data
      const result = await this.dataLayer.importFromCSV(text);
      
      console.log(`FileManager: Imported ${result.imported} households`);
      
      // Update map and UI
      await this.updateUIAfterLoad(result);
      
      // Show success message
      const stats = this.state.getStats();
      this.status.success(`Loaded ${result.imported} households in ${stats.totalRegions} regions from ${file.name}`);
      
      // Notify other components
      this.state.notify('households:loaded', result.households);
      
      return result;
      
    } catch (error) {
      console.error('FileManager: File load error:', error);
      this.status.error(`Failed to load ${file.name}: ${error.message}`);
      return null;
    }
  }
  
  // File reading utility
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      // Detect encoding and read
      reader.readAsText(file, 'UTF-8');
    });
  }
  
  // UI updates after successful load
  async updateUIAfterLoad(result) {
    // Create map markers
    if (this.mapManager && this.mapManager.createMapMarkers) {
      this.mapManager.createMapMarkers();
    }
    
    // Update map boundaries  
    if (this.mapManager && this.mapManager.updateBoundaries) {
      this.mapManager.updateBoundaries();
    }
    
    // Close hamburger menu after successful load
    this.closeHamburgerMenu();
  }
  
  closeHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    if (menu && menu.style.display === 'block') {
      window.closeHamburgerMenu();
    }
  }
  
  // CSV Export functionality
  exportToCSV(filename = null) {
    try {
      // Generate CSV data
      const csvData = this.dataLayer.exportToCSV();
      
      if (!csvData) {
        this.status.error('No data to export');
        return false;
      }
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().split('T')[0];
        filename = `ward-data-${timestamp}.csv`;
      }
      
      // Ensure .csv extension
      if (!filename.toLowerCase().endsWith('.csv')) {
        filename += '.csv';
      }
      
      // Create and download file
      this.downloadFile(csvData, filename, 'text/csv');
      
      // Notify that file was saved
      this.state.notify('file:saved', { filename, type: 'csv' });
      
      // Log export statistics
      const stats = this.state.getStats();
      console.log(`FileManager: Exported ${stats.total} households to ${filename}`);
      this.status.success(`Exported ${stats.total} households to ${filename}`);
      
      return true;
      
    } catch (error) {
      console.error('FileManager: Export error:', error);
      this.status.error(`Export failed: ${error.message}`);
      return false;
    }
  }
  
  // File download utility
  downloadFile(content, filename, mimeType = 'text/plain') {
    // Create blob
    const blob = new Blob([content], { type: mimeType });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Trigger file selection dialog
  triggerFileLoad() {
    if (this.fileInput) {
      this.fileInput.click();
    } else {
      this.status.error('File input not available');
    }
  }
  
  // Export with custom options
  exportWithOptions(options = {}) {
    const {
      filename = null,
      includeModifiedOnly = false,
      includeOriginalFields = false
    } = options;
    
    try {
      // Get export data with options
      const csvData = this.dataLayer.exportToCSV({
        includeModifiedOnly,
        includeOriginalFields
      });
      
      if (!csvData) {
        this.status.error('No data to export');
        return false;
      }
      
      // Generate filename based on options
      let exportFilename = filename;
      if (!exportFilename) {
        const timestamp = new Date().toISOString().split('T')[0];
        const suffix = includeModifiedOnly ? '-changes' : '';
        exportFilename = `ward-data-${timestamp}${suffix}.csv`;
      }
      
      this.downloadFile(csvData, exportFilename, 'text/csv');
      
      // Notify that file was saved
      this.state.notify('file:saved', { filename: exportFilename, type: 'csv' });
      
      const exportType = includeModifiedOnly ? 'modified' : 'all';
      this.status.success(`Exported ${exportType} household data to ${exportFilename}`);
      
      return true;
      
    } catch (error) {
      console.error('FileManager: Export with options error:', error);
      this.status.error(`Export failed: ${error.message}`);
      return false;
    }
  }
  
  // Quick export for specific data sets
  exportChangesOnly() {
    return this.exportWithOptions({
      includeModifiedOnly: true,
      filename: `ward-changes-${new Date().toISOString().split('T')[0]}.csv`
    });
  }
  
  exportBackup() {
    return this.exportWithOptions({
      includeOriginalFields: true,
      filename: `ward-backup-${new Date().toISOString().split('T')[0]}.csv`
    });
  }
  
  // File import validation
  async validateCSVStructure(file) {
    try {
      const text = await this.readFileAsText(file);
      
      // Parse just the header to check structure
      const lines = text.split('\\n');
      if (lines.length < 2) {
        return { valid: false, error: 'File appears to be empty or malformed' };
      }
      
      const header = lines[0];
      const requiredColumns = [
        'HouseholdName', 'Latitude', 'Longitude'
      ];
      
      const hasRequiredColumns = requiredColumns.every(col => 
        header.toLowerCase().includes(col.toLowerCase())
      );
      
      if (!hasRequiredColumns) {
        return { 
          valid: false, 
          error: `Missing required columns. Expected: ${requiredColumns.join(', ')}` 
        };
      }
      
      return { valid: true, columnCount: header.split(',').length };
      
    } catch (error) {
      return { valid: false, error: `File validation failed: ${error.message}` };
    }
  }
  
  // Get file statistics
  getFileStats() {
    const stats = this.state.getStats();
    return {
      households: stats.total,
      regions: stats.totalRegions,
      changes: this.state.getChangeHistory().length,
      lastModified: this.state.getLastModified()
    };
  }
  
  // Public API methods
  getFileInput() {
    return this.fileInput;
  }
  
  getSupportedTypes() {
    return this.supportedTypes;
  }
}


