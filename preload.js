// preload.js - Electron preload script
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectCSVFile: () => ipcRenderer.invoke('select-csv-file'),
  saveCSVFile: (content, defaultName) => ipcRenderer.invoke('save-csv-file', { content, defaultName }),
  saveJSONFile: (content, defaultName) => ipcRenderer.invoke('save-json-file', { content, defaultName }),

  // Tile operations
  downloadTiles: (tiles, layerType) => ipcRenderer.invoke('download-tiles', { tiles, layerType }),
  checkTileExists: (tileKey, layerType) => ipcRenderer.invoke('check-tile-exists', { tileKey, layerType }),

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Event listeners
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },

  // Menu event listeners
  onMenuAction: (callback) => {
    // File menu events
    ipcRenderer.on('menu-load-csv', () => callback('load-csv'));
    ipcRenderer.on('menu-save-csv', () => callback('save-csv'));
    ipcRenderer.on('menu-save-csv-as', () => callback('save-csv-as'));
    ipcRenderer.on('menu-export-tiles', () => callback('export-tiles'));
    
    // View menu events
    ipcRenderer.on('menu-toggle-sidebar', () => callback('toggle-sidebar'));
    ipcRenderer.on('menu-show-statistics', () => callback('show-statistics'));
    
    // Tools menu events
    ipcRenderer.on('menu-check-tiles', () => callback('check-tiles'));
    ipcRenderer.on('menu-download-tiles', () => callback('download-tiles'));
    ipcRenderer.on('menu-clear-tiles', () => callback('clear-tiles'));
  }
});

// Environment detection
contextBridge.exposeInMainWorld('isElectron', true);

// Make sure window.isElectron is available globally
window.isElectron = true;