// utils.js - Utility functions and constants

// Region colors
const COLORS = [
  '#e74c3c', '#27ae60', '#3498db', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#8e44ad', '#16a085', '#2ecc71'
];

// Calculate convex hull for region boundaries
function getConvexHull(points) {
  if (points.length < 3) return points;
  
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  
  const lower = [];
  for (let i = 0; i < points.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], points[i]) <= 0) {
      lower.pop();
    }
    lower.push(points[i]);
  }
  
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], points[i]) <= 0) {
      upper.pop();
    }
    upper.push(points[i]);
  }
  
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

// Status message display
function setStatus(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  if (statusMessage) {
    statusMessage.textContent = message;
  }
}

// Parse CSV headers - find actual column positions
function parseHeaders(headers) {
  // Initialize with -1 (not found)
  const COLUMNS = {
    name: -1,
    lat: -1,
    lon: -1,
    address: -1,
    isIsolated: -1,
    specialNeeds: -1,
    medicalSkills: -1,
    recoverySkills: -1,
    recoveryEquipment: -1,
    communicationSkillsAndEquipment: -1,
    communicationsRegionName: -1,
    communicationsClusterId: -1
  };
  
  // Find all columns by exact header match
  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();
    if (h === 'householdname') COLUMNS.name = index;
    else if (h === 'latitude') COLUMNS.lat = index;
    else if (h === 'longitude') COLUMNS.lon = index;
    else if (h === 'address') COLUMNS.address = index;
    else if (h === 'isisolated') COLUMNS.isIsolated = index;
    else if (h === 'specialneeds') COLUMNS.specialNeeds = index;
    else if (h === 'medicalskills') COLUMNS.medicalSkills = index;
    else if (h === 'recoveryskills') COLUMNS.recoverySkills = index;
    else if (h === 'recoveryequipment') COLUMNS.recoveryEquipment = index;
    else if (h === 'communicationskillsandequipment') COLUMNS.communicationSkillsAndEquipment = index;
    else if (h === 'communicationsregionname') COLUMNS.communicationsRegionName = index;
    else if (h === 'communicationsclusterid') COLUMNS.communicationsClusterId = index;
  });
  
  return COLUMNS;
}

// Dynamic resource discovery - attach to window for global access
window.discoveredMedicalSkills = window.discoveredMedicalSkills || new Set();
window.discoveredRecoverySkills = window.discoveredRecoverySkills || new Set();
window.discoveredRecoveryEquipment = window.discoveredRecoveryEquipment || new Set();
window.discoveredCommunicationSkillsAndEquipment = window.discoveredCommunicationSkillsAndEquipment || new Set();

// Parse equipment and communications text to extract items
function parseResourceText(text) {
  if (!text) return [];
  
  // Split by common separators and clean up
  const items = text.toLowerCase()
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .filter(item => !['yes', 'no', 'have', 'of', 'the', 'and', 'a', 'an', 'with', 'for', 'to', 'in', 'on', 'at'].includes(item));
  
  return items;
}

// Update discovered resources from all household data
function updateDiscoveredResources() {
  window.discoveredMedicalSkills.clear();
  window.discoveredRecoverySkills.clear();
  window.discoveredRecoveryEquipment.clear();
  window.discoveredCommunicationSkillsAndEquipment.clear();
  
  if (!window.wardData || window.wardData.length === 0) {
    console.log('updateDiscoveredResources: No ward data available');
    return;
  }
  
  console.log(`updateDiscoveredResources: Processing ${window.wardData.length} households`);
  
  window.wardData.forEach(household => {
    // Parse medical skills
    if (household.medicalSkills && household.medicalSkills.trim()) {
      console.log(`Found medical skills for ${household.name}: ${household.medicalSkills}`);
      parseResourceText(household.medicalSkills).forEach(item => {
        const skillName = item.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (skillName) {
          window.discoveredMedicalSkills.add(skillName.toLowerCase());
        }
      });
    }
    
    // Parse recovery skills
    if (household.recoverySkills && household.recoverySkills.trim()) {
      console.log(`Found recovery skills for ${household.name}: ${household.recoverySkills}`);
      parseResourceText(household.recoverySkills).forEach(item => {
        const skillName = item.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (skillName) {
          window.discoveredRecoverySkills.add(skillName.toLowerCase());
        }
      });
    }
    
    // Parse recovery equipment
    if (household.recoveryEquipment && household.recoveryEquipment.trim()) {
      console.log(`Found recovery equipment for ${household.name}: ${household.recoveryEquipment}`);
      parseResourceText(household.recoveryEquipment).forEach(item => {
        window.discoveredRecoveryEquipment.add(item.toLowerCase());
      });
    }
    
    // Parse combined communication skills and equipment
    if (household.communicationSkillsAndEquipment && household.communicationSkillsAndEquipment.trim()) {
      console.log(`Found communication skills and equipment for ${household.name}: ${household.communicationSkillsAndEquipment}`);
      parseResourceText(household.communicationSkillsAndEquipment).forEach(item => {
        const itemName = item.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (itemName) {
          window.discoveredCommunicationSkillsAndEquipment.add(itemName.toLowerCase());
        }
      });
    }
  });
  
  console.log(`Discovered ${window.discoveredMedicalSkills.size} medical skills, ${window.discoveredRecoverySkills.size} recovery skills, ${window.discoveredRecoveryEquipment.size} recovery equipment, ${window.discoveredCommunicationSkillsAndEquipment.size} communication skills and equipment`);
}

// Check offline status by testing for tile existence
function checkOfflineStatus() {
  const testImg = new Image();
  testImg.onerror = function() {
    console.log('Tiles directory not found - run downloader if maps don\'t appear');
  };
  testImg.onload = function() {
    console.log('Offline tiles detected');
  };
  // Try a zoom 9 tile which should exist if downloader was run
  testImg.src = 'tiles/osm/9/144/202.png';
}

// Expose functions globally
window.updateDiscoveredResources = updateDiscoveredResources;