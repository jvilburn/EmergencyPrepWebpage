// household.js - Household class definition

class Household {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name?.trim() || '';
    this.lat = parseFloat(data.lat) || 0;
    this.lon = parseFloat(data.lon) || 0;
    this.address = data.address?.trim() || '';
    this.specialNeeds = data.specialNeeds?.trim() || '';
    this.medicalSkills = data.medicalSkills?.trim() || '';
    this.recoverySkills = data.recoverySkills?.trim() || '';
    this.recoveryEquipment = data.recoveryEquipment?.trim() || '';
    this.communicationSkillsAndEquipment = data.communicationSkillsAndEquipment?.trim() || '';
    this.communicationsRegionName = data.communicationsRegionName?.trim() || '';
    this.communicationsClusterId = data.communicationsClusterId ? parseInt(data.communicationsClusterId) : null;
    this.created = data.created || Date.now();
    this.modified = data.modified || Date.now();
  }
  
  generateId() {
    return 'h' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }
  
  isIsolated() {
    const hasRegion = this.communicationsRegionName && this.communicationsRegionName.trim() !== '';
    const hasCluster = this.communicationsClusterId && this.communicationsClusterId > 0;
    return !hasRegion && !hasCluster;
  }
  
  // Convert to plain object for serialization
  toObject() {
    return {
      id: this.id,
      name: this.name,
      lat: this.lat,
      lon: this.lon,
      address: this.address,
      specialNeeds: this.specialNeeds,
      medicalSkills: this.medicalSkills,
      recoverySkills: this.recoverySkills,
      recoveryEquipment: this.recoveryEquipment,
      communicationSkillsAndEquipment: this.communicationSkillsAndEquipment,
      communicationsRegionName: this.communicationsRegionName,
      communicationsClusterId: this.communicationsClusterId,
      created: this.created,
      modified: this.modified
    };
  }
  
  // Create Household instance from plain object
  static fromObject(data) {
    return new Household(data);
  }
}

// Export for use in modules
window.Household = Household;