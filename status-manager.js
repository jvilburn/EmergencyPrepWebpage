// status-manager.js - Centralized status display management

class StatusManager {
  constructor() {
    this.statusElement = null;
    this.history = [];
    this.maxHistory = 50;
    this.init();
  }
  
  init() {
    // Find status element
    this.statusElement = document.getElementById('statusMessage');
    if (!this.statusElement) {
      console.warn('Status element not found in DOM');
    }
  }
  
  setStatus(message, type = 'info') {
    // Update DOM element if available
    if (this.statusElement) {
      this.statusElement.textContent = message;
      this.statusElement.className = `status ${type}`;
    }
    
    // Log to console
    const logMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
    console[logMethod](`[${type.toUpperCase()}] ${message}`);
    
    // Add to history
    this.addToHistory(message, type);
    
    // Notify listeners
    this.notify(message, type);
  }
  
  // Convenience methods
  info(message) {
    this.setStatus(message, 'info');
  }
  
  success(message) {
    this.setStatus(message, 'success');
  }
  
  error(message) {
    this.setStatus(message, 'error');
  }
  
  warning(message) {
    this.setStatus(message, 'warning');
  }
  
  addToHistory(message, type) {
    this.history.push({
      message,
      type,
      timestamp: new Date().toISOString()
    });
    
    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
  
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
  
  clearHistory() {
    this.history = [];
  }
  
  notify(message, type) {
    // Dispatch custom event for other components to listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('statusChanged', {
        detail: { message, type, timestamp: new Date().toISOString() }
      }));
    }
  }
  
  // Get current status
  getCurrentStatus() {
    if (this.history.length > 0) {
      return this.history[this.history.length - 1];
    }
    return null;
  }
}

// Create global instance
window.statusManager = new StatusManager();