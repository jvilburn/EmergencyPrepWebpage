// change-notification.js - Visual change notification system

class ChangeNotification {
  constructor(stateManager) {
    this.state = stateManager;
    this.notificationElement = null;
    this.countElement = null;
    this.hideTimer = null;
    
    this.init();
  }
  
  init() {
    this.notificationElement = document.getElementById('changeNotification');
    this.countElement = document.getElementById('changeCount');
    
    if (!this.notificationElement || !this.countElement) {
      console.error('ChangeNotification: Required elements not found');
      return;
    }
    
    // Listen for data changes
    this.state.subscribe('household:added', () => this.onDataChange());
    this.state.subscribe('household:updated', () => this.onDataChange());
    this.state.subscribe('household:deleted', () => this.onDataChange());
    this.state.subscribe('households:loaded', () => this.onDataLoaded());
    this.state.subscribe('file:saved', () => this.onFileSaved());
    
    console.log('ChangeNotification: Initialized');
  }
  
  onDataChange() {
    this.updateDisplay();
    this.showNotification();
  }
  
  onDataLoaded() {
    // Hide notification when new data is loaded
    this.hideNotification();
  }
  
  onFileSaved() {
    // Hide notification when file is saved
    this.hideNotification();
  }
  
  updateDisplay() {
    if (!this.countElement) return;
    
    // Count households that have been modified
    const households = this.state.getAllHouseholds();
    const modifiedCount = households.filter(h => h.isModified()).length;
    
    const recordText = modifiedCount === 1 ? 'Record' : 'Records';
    this.countElement.textContent = `${modifiedCount} ${recordText} Changed`;
    
    return modifiedCount;
  }
  
  showNotification() {
    // Get current count of modified records
    const modifiedCount = this.updateDisplay();
    
    if (!this.notificationElement || modifiedCount === 0) return;
    
    // Clear any existing hide timer (notification stays until file is saved)
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    
    // Show the notification
    this.notificationElement.classList.remove('hidden');
    this.notificationElement.classList.add('show');
  }
  
  hideNotification() {
    if (!this.notificationElement) return;
    
    this.notificationElement.classList.remove('show');
    this.notificationElement.classList.add('hidden');
    
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
  
  // Public methods
  getChangeCount() {
    const households = this.state.getAllHouseholds();
    return households.filter(h => h.isModified()).length;
  }
  
  forceShow() {
    if (this.getChangeCount() > 0) {
      this.showNotification();
    }
  }
  
  forceHide() {
    this.hideNotification();
  }
}

