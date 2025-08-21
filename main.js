// main.js - Electron main process
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');

let mainWindow;

// Enable live reload for development
if (process.argv.includes('--dev')) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (_) {}
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Load CSV...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            mainWindow.webContents.send('menu-load-csv');
          }
        },
        {
          label: 'Save CSV...',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            mainWindow.webContents.send('menu-save-csv');
          }
        },
        {
          label: 'Save CSV As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            mainWindow.webContents.send('menu-save-csv-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Missing Tiles...',
          click: async () => {
            mainWindow.webContents.send('menu-export-tiles');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            mainWindow.webContents.send('menu-toggle-sidebar');
          }
        },
        {
          label: 'Statistics',
          click: () => {
            mainWindow.webContents.send('menu-show-statistics');
          }
        },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Check Missing Tiles Count',
          click: () => {
            mainWindow.webContents.send('menu-check-tiles');
          }
        },
        {
          label: 'Download Missing Tiles',
          click: () => {
            mainWindow.webContents.send('menu-download-tiles');
          }
        },
        {
          label: 'Clear Missing Tiles Tracking',
          click: () => {
            mainWindow.webContents.send('menu-clear-tiles');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Ward Directory Map',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Ward Directory Map',
              message: 'Ward Directory Map',
              detail: 'Version 1.0.0\n\nAn offline mapping application for church/LDS ward management.\n\nFeatures household tracking, emergency resource management, and region/cluster organization.',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'View Documentation',
          click: () => {
            shell.openExternal('https://github.com/ward-directory-map/docs');
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: 'Services', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Hide ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Command+Shift+H', role: 'hideothers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  // Create application menu
  createMenu();

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for file operations
ipcMain.handle('select-csv-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) return null;

  try {
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      path: filePath,
      content: content,
      name: path.basename(filePath)
    };
  } catch (error) {
    console.error('Error reading CSV file:', error);
    throw error;
  }
});

ipcMain.handle('save-csv-file', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'ward_data.csv',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) return null;

  try {
    await fs.writeFile(result.filePath, content, 'utf-8');
    return {
      path: result.filePath,
      name: path.basename(result.filePath)
    };
  } catch (error) {
    console.error('Error saving CSV file:', error);
    throw error;
  }
});

ipcMain.handle('save-json-file', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'missing-tiles.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) return null;

  try {
    await fs.writeFile(result.filePath, content, 'utf-8');
    return {
      path: result.filePath,
      name: path.basename(result.filePath)
    };
  } catch (error) {
    console.error('Error saving JSON file:', error);
    throw error;
  }
});

// Tile downloading functionality
ipcMain.handle('download-tiles', async (event, { tiles, layerType }) => {
  const tilesDir = path.join(__dirname, 'tiles', layerType);
  await fs.ensureDir(tilesDir);

  let downloaded = 0;
  const total = tiles.length;
  const errors = [];

  for (const tileKey of tiles) {
    try {
      const success = await downloadTile(tileKey, layerType, tilesDir);
      if (success) {
        downloaded++;
        // Send progress update
        event.sender.send('download-progress', {
          downloaded,
          total,
          current: tileKey
        });
      }
    } catch (error) {
      errors.push({ tile: tileKey, error: error.message });
    }
  }

  // Update manifest after downloading
  await updateTileManifest(layerType, tilesDir);

  return {
    downloaded,
    total,
    errors
  };
});

async function downloadTile(tileKey, layerType, tilesDir) {
  const [z, x, y] = tileKey.split('/').map(Number);
  
  let url, filePath;
  
  if (layerType === 'osm') {
    url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    filePath = path.join(tilesDir, z.toString(), x.toString(), `${y}.png`);
  } else if (layerType === 'satellite') {
    // ArcGIS World Imagery
    url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    filePath = path.join(tilesDir, z.toString(), y.toString(), `${x}.png`);
  } else {
    throw new Error(`Unknown layer type: ${layerType}`);
  }

  // Check if tile already exists
  if (await fs.pathExists(filePath)) {
    return true;
  }

  // Create directory structure
  await fs.ensureDir(path.dirname(filePath));

  // Download tile with retry logic
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ward Directory Map/1.0.0'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      await fs.writeFile(filePath, buffer);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      if (attempt === 2) {
        console.error(`Failed to download tile ${tileKey}:`, error.message);
        return false;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  return false;
}

async function updateTileManifest(layerType, tilesDir) {
  const tiles = [];
  
  // Recursively find all tile files
  const findTiles = async (dir, relativePath = '') => {
    const entries = await fs.readdir(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await findTiles(fullPath, path.join(relativePath, entry));
      } else if (entry.endsWith('.png')) {
        tiles.push(path.join(relativePath, entry).replace(/\\/g, '/'));
      }
    }
  };

  await findTiles(tilesDir);

  // Create manifest object
  const manifest = {
    name: layerType === 'osm' ? 'OpenStreetMap Tiles' : 'Satellite Imagery Tiles',
    type: layerType,
    format: layerType === 'osm' ? 'z/x/y' : 'z/y/x',
    tile_count: tiles.length,
    tiles: tiles.sort(),
    zoom_levels: [...new Set(tiles.map(t => parseInt(t.split('/')[0])))].sort((a, b) => a - b),
    generated: new Date().toISOString()
  };

  // Write JavaScript manifest file
  const manifestContent = `const ${layerType}Manifest = ${JSON.stringify(manifest, null, 2)};`;
  const manifestPath = path.join(__dirname, 'tiles', `${layerType}-manifest.js`);
  
  await fs.writeFile(manifestPath, manifestContent, 'utf-8');
  
  console.log(`Updated ${layerType} manifest: ${tiles.length} tiles`);
}

// Check tile availability
ipcMain.handle('check-tile-exists', async (event, { tileKey, layerType }) => {
  const [z, x, y] = tileKey.split('/').map(Number);
  
  let filePath;
  if (layerType === 'osm') {
    filePath = path.join(__dirname, 'tiles', 'osm', z.toString(), x.toString(), `${y}.png`);
  } else {
    filePath = path.join(__dirname, 'tiles', 'satellite', z.toString(), y.toString(), `${x}.png`);
  }
  
  return await fs.pathExists(filePath);
});

// Get application info
ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    dataPath: app.getPath('userData')
  };
});