# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Ward Directory Map application for church/LDS ward management, featuring offline mapping capabilities with household tracking, emergency resource management, and region/cluster organization.

## Repository Structure

```
EmergencyPrepWebpage/          # Main offline ward map application
├── CLAUDE.md                  # This file - Claude Code guidance
├── index.html                 # Single-file web application with embedded JS/CSS
├── app.js                     # Main application logic
├── map.js                     # Map functionality
├── data.js                    # Data handling
├── ui.js                      # User interface components
├── utils.js                   # Utility functions
├── styles.css                 # Styling
├── tiles/                     # Offline map tiles and manifests
│   ├── osm/                  # Street map tiles (z/x/y format)
│   ├── satellite/            # Satellite imagery tiles (z/y/x format)  
│   ├── osm-manifest.js       # OSM tile availability manifest
│   └── satellite-manifest.js # Satellite tile availability manifest
└── ward_data_merged_simple.csv # Household data
```

## Common Development Tasks

### Running the Application
1. **Open locally**: Simply open `index.html` in a web browser (no server required)
2. **Load data**: Drag and drop a CSV file onto the application or use the file picker

### Downloading Map Tiles for Offline Use
The tile downloader is now a compiled application (not Python) that:
1. Downloads tiles based on ward boundaries or missing tile reports
2. Generates tile manifest files (`osm-manifest.js`, `satellite-manifest.js`)
3. Eliminates console errors by telling the app which tiles exist before loading

**Tile Manifest System:**
- Manifest files contain JavaScript constants listing all available tiles
- Loaded as `<script>` tags to avoid CORS issues with `file://` protocol
- Web app checks manifests before attempting to load tiles
- No console errors for missing tiles - app skips directly to online fallback

### Testing the Application
- Load CSV data with proper 11-column format
- Test default "By Name" sort vs "By Communication Region" sort
- Verify resource filtering functionality (Special Needs, skills, equipment)
- Test resource filter persistence after page refresh
- Test resource filter refresh after household edits
- Check data export includes all fields in current format
- Ensure changes persist in localStorage
- Verify scrollable resource filters with Clear All button accessibility

## Architecture & Key Components

### CSV Data Format
Current CSV format with 11 columns (order matters):
1. **HouseholdName** - Family name
2. **Latitude** - Decimal latitude
3. **Longitude** - Decimal longitude
4. **Address** - Street address (optional)
5. **SpecialNeeds** - Text field for special needs information
6. **MedicalSkills** - Text field for medical skills/training
7. **RecoverySkills** - Text field for recovery/disaster response skills
8. **RecoveryEquipment** - Text field for recovery/disaster response equipment
9. **CommunicationSkillsAndEquipment** - Text field for communication capabilities
10. **CommunicationsRegionName** - Region display name for communications
11. **CommunicationsClusterId** - Integer cluster ID for communications

**Format Notes:**
- Region/cluster info is derived from CommunicationsRegionName and CommunicationsClusterId
- Isolation status is derived from households having neither region nor cluster assignment
- All text fields support comma-separated lists for multiple items
- Resource filtering dynamically discovers available items from text fields

### Key JavaScript Components

**Data Management** (`data.js`):
- CSV parsing with flexible column detection
- localStorage persistence
- Change tracking with undo functionality

**Map Functionality** (`map.js`):
- Leaflet-based mapping with offline tiles
- Dual-layer support (street/satellite)
- Smart tile fallback system
- Region/cluster boundary visualization

**UI Components** (`ui.js`):
- Clean collapsible interface with hamburger menu
- Sort by Name (default) or By Communication Region
- Dynamic resource filtering with Special Needs checkbox
- Search and filter functionality
- Edit mode for household management
- Resource discovery from text fields (medical skills, recovery skills/equipment, communication skills/equipment)

**Region/Cluster Management** (`region-cluster-manager.js`):
- Create, rename, and delete regions
- Create and delete clusters within regions
- Map-based selection tools (rectangle/click selection)
- Bulk assignment of households to clusters
- Bulk reassignment of clusters to regions
- Visual feedback during selection process

### Technical Notes
- **No build process required** - vanilla JavaScript, no frameworks
- **Single-file design** for easy distribution
- **Offline-first** - works completely without internet after tile download
- **Dependencies**: Leaflet 1.9.4 (CDN), PapaParse 5.4.1 (CDN)
- **Storage**: Browser localStorage (~5MB limit)
- **Performance**: Handles 500+ households well

## Important Patterns

### Dynamic Column Detection
The application automatically detects CSV columns by header name patterns, making it flexible for different data formats.

### Resource Value Checking
Resource fields accept multiple true representations: 'true', '1', 'yes', 'y'

### Multiple Households at Same Location
The application handles apartments/shared addresses with a selection dialog in edit mode.

### Tile Manifest System
The application uses JavaScript manifest files to track tile availability:

**Manifest Files:**
- `tiles/osm-manifest.js` - Lists all available OSM street map tiles
- `tiles/satellite-manifest.js` - Lists all available satellite imagery tiles

**Format:**
```javascript
const osmManifest = {
  "name": "OpenStreetMap Tiles",
  "type": "osm",
  "format": "z/x/y",
  "tile_count": 1010,
  "tiles": [
    "10/281/398.png",
    "11/562/796.png",
    // ... more tiles
  ],
  "zoom_levels": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
};
```

**Benefits:**
- **No console errors** - App knows which tiles exist before attempting to load
- **CORS compatible** - Uses `<script>` tags instead of fetch() calls
- **Performance** - Eliminates wasted requests for missing tiles
- **Offline-first** - Works with file:// protocol without server

## Recent Updates & Bug Fixes

### UI Improvements
- Switched sort button order: "By Name" first (default), "By Communication Region" second
- Added Special Needs checkbox to resource filters for households with non-empty special needs
- Fixed resource filters showing "no data" on page refresh by ensuring proper data processing
- Fixed resource filters not updating after household edits by refreshing discovery on changes
- Fixed layout issue where "Clear All" button was pushed down by adding scrollable height constraint

### Data Format Changes
- Updated CSV structure to 12-column format with clear resource separation
- Fixed data alignment issues where recovery skills/equipment were in wrong columns
- Communication skills/equipment now properly combined in single field

## Development Guidelines

1. **Maintain offline capability** - No external API calls after initial setup
2. **Keep single-file design** when possible for easy distribution
3. **Test with 12-column CSV format** to ensure compatibility
4. **Preserve localStorage data** - Don't clear without user action
5. **Follow existing code patterns** - vanilla JavaScript, no frameworks
6. **Resource discovery** - Always call updateDiscoveredResources() and buildResourceFilters() after data changes
7. **Tile manifests** - External tile downloader app maintains manifest files; web app only reads them
8. **No fetch() for local files** - Use JavaScript includes or avoid to prevent CORS issues