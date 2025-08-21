// test-electron.js - Test Electron integration without GUI
const fs = require('fs');
const path = require('path');

console.log('Testing Electron Ward Directory Map Integration...\n');

// Test 1: Check if all required files exist
const requiredFiles = [
  'main.js',
  'preload.js',
  'package.json',
  'index.html',
  'app.js',
  'map-manager.js',
  'state-manager.js',
  'data-layer.js',
  'file-manager.js',
  'tile-manager.js'
];

console.log('1. Checking required files...');
let allFilesExist = true;
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
}

if (!allFilesExist) {
  console.log('\n❌ Missing required files!');
  process.exit(1);
}

// Test 2: Check package.json structure
console.log('\n2. Validating package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  const checks = [
    { key: 'main', expected: 'main.js', value: packageJson.main },
    { key: 'dependencies.node-fetch', expected: 'exists', value: packageJson.dependencies?.['node-fetch'] },
    { key: 'dependencies.fs-extra', expected: 'exists', value: packageJson.dependencies?.['fs-extra'] },
    { key: 'devDependencies.electron', expected: 'exists', value: packageJson.devDependencies?.electron }
  ];
  
  for (const check of checks) {
    const passed = check.expected === 'exists' ? !!check.value : check.value === check.expected;
    console.log(`  ${passed ? '✓' : '✗'} ${check.key}: ${check.value || 'missing'}`);
  }
} catch (error) {
  console.log(`  ✗ Error reading package.json: ${error.message}`);
}

// Test 3: Check main.js structure
console.log('\n3. Validating main.js...');
try {
  const mainContent = fs.readFileSync('main.js', 'utf-8');
  
  const requiredImports = [
    'require(\'electron\')',
    'require(\'fs-extra\')',
    'require(\'node-fetch\')'
  ];
  
  const requiredFunctions = [
    'createWindow',
    'ipcMain.handle(\'select-csv-file\'',
    'ipcMain.handle(\'save-csv-file\'',
    'ipcMain.handle(\'download-tiles\''
  ];
  
  for (const imp of requiredImports) {
    const exists = mainContent.includes(imp);
    console.log(`  ${exists ? '✓' : '✗'} Import: ${imp}`);
  }
  
  for (const func of requiredFunctions) {
    const exists = mainContent.includes(func);
    console.log(`  ${exists ? '✓' : '✗'} Function: ${func}`);
  }
} catch (error) {
  console.log(`  ✗ Error reading main.js: ${error.message}`);
}

// Test 4: Check preload.js structure
console.log('\n4. Validating preload.js...');
try {
  const preloadContent = fs.readFileSync('preload.js', 'utf-8');
  
  const requiredAPIs = [
    'contextBridge.exposeInMainWorld',
    'selectCSVFile',
    'saveCSVFile',
    'downloadTiles',
    'window.isElectron'
  ];
  
  for (const api of requiredAPIs) {
    const exists = preloadContent.includes(api);
    console.log(`  ${exists ? '✓' : '✗'} API: ${api}`);
  }
} catch (error) {
  console.log(`  ✗ Error reading preload.js: ${error.message}`);
}

// Test 5: Check file-manager.js Electron integration
console.log('\n5. Validating FileManager Electron integration...');
try {
  const fileManagerContent = fs.readFileSync('file-manager.js', 'utf-8');
  
  const requiredChecks = [
    'window.isElectron',
    'window.electronAPI',
    'electronAPI.selectCSVFile',
    'electronAPI.saveCSVFile',
    'loadFileFromElectron'
  ];
  
  for (const check of requiredChecks) {
    const exists = fileManagerContent.includes(check);
    console.log(`  ${exists ? '✓' : '✗'} Integration: ${check}`);
  }
} catch (error) {
  console.log(`  ✗ Error reading file-manager.js: ${error.message}`);
}

// Test 6: Check tiles directory structure
console.log('\n6. Checking tiles directory...');
const tilesDir = path.join(__dirname, 'tiles');
if (fs.existsSync(tilesDir)) {
  console.log(`  ✓ tiles/ directory exists`);
  
  const subdirs = ['osm', 'satellite'];
  for (const subdir of subdirs) {
    const subdirPath = path.join(tilesDir, subdir);
    const exists = fs.existsSync(subdirPath);
    console.log(`  ${exists ? '✓' : '✗'} tiles/${subdir}/ directory`);
  }
  
  // Check for manifest files
  const manifests = ['osm-manifest.js', 'satellite-manifest.js'];
  for (const manifest of manifests) {
    const manifestPath = path.join(tilesDir, manifest);
    const exists = fs.existsSync(manifestPath);
    console.log(`  ${exists ? '✓' : '✗'} tiles/${manifest}`);
  }
} else {
  console.log(`  ✗ tiles/ directory missing`);
}

console.log('\n🎯 Electron Integration Test Complete!');
console.log('\nTo test the app:');
console.log('1. Move to Windows (outside WSL)');
console.log('2. Run: npm start');
console.log('3. Test CSV loading with native dialogs');
console.log('4. Verify tile manifest system works');
console.log('5. Test file saving with native dialogs');