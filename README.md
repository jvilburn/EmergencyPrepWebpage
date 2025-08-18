# Ward Directory Map - Offline Edition

A comprehensive offline mapping application for church/LDS ward management, featuring household tracking, emergency resource management, and region/cluster organization.

## Features

- **Offline Mapping**: Works completely offline after initial setup
- **Household Management**: Track household locations, contact info, and special needs
- **Resource Tracking**: Medical skills, recovery equipment, communication capabilities
- **Region/Cluster Organization**: Organize households into communication regions and clusters
- **Emergency Preparedness**: Special needs tracking and resource discovery
- **Data Export/Import**: CSV-based data management
- **No Server Required**: Pure client-side application

## Quick Start

1. **Open the application**: Simply open `index.html` in a web browser
2. **Load data**: Drag and drop a CSV file or use File > Load CSV
3. **Download offline maps** (optional): Run `python tile-downloader.py`

## CSV Data Format

The application expects a 12-column CSV format:

1. **HouseholdName** - Family name
2. **Latitude** - Decimal latitude
3. **Longitude** - Decimal longitude  
4. **Address** - Street address (optional)
5. **IsIsolated** - Boolean (true/false)
6. **SpecialNeeds** - Special needs information
7. **MedicalSkills** - Medical skills/training
8. **RecoverySkills** - Recovery/disaster response skills
9. **RecoveryEquipment** - Recovery/disaster response equipment
10. **CommunicationSkillsAndEquipment** - Communication capabilities
11. **CommunicationsRegionName** - Region display name
12. **CommunicationsClusterId** - Integer cluster ID

## Offline Map Setup

**Note**: Offline map tiles are not included in this repository due to size constraints.

To download offline map tiles:

```bash
python tile-downloader.py
```

This will create the `tiles/` directory structure:
- `tiles/osm/` - Street map tiles
- `tiles/satellite/` - Satellite imagery tiles

The application will work without offline tiles but requires an internet connection for maps.

## Project Structure

```
EmergencyPrepWebpage/
├── index.html                 # Main application (single-file design)
├── app.js                     # Core application logic
├── map.js                     # Leaflet mapping functionality
├── data.js                    # CSV parsing and data management
├── ui.js                      # User interface components
├── utils.js                   # Utility functions
├── styles.css                 # Application styling
├── region-cluster-manager.js  # Region/cluster management
├── tile-downloader.py         # Offline map tile downloader
├── ward_data.csv             # Sample household data
└── tiles/                    # Offline map tiles (not in repo)
    ├── osm/                  # Street map tiles
    └── satellite/            # Satellite imagery tiles
```

## Usage

### Loading Data
- Use the hamburger menu (☰) > File Operations > Load CSV
- Or drag and drop a CSV file onto the application

### Viewing Households
- **By Name**: Default alphabetical sorting
- **By Communication Region**: Group by regions and clusters
- Use the search box to filter households

### Resource Filtering
- Filter by Special Needs, Medical Skills, Recovery Skills/Equipment
- Resource filters discover available items from the data
- Use "Clear All" to reset filters

### Managing Regions and Clusters
- Use Manage Regions from the hamburger menu
- Create, rename, and delete regions
- Assign households to clusters using map selection tools
- Bulk operations for efficient organization

### Editing Households
- Click on any household marker to edit
- Changes are automatically saved to localStorage
- Use "View Changes" to see modifications
- "Undo Last" to revert recent changes

## Technical Details

- **Framework**: Vanilla JavaScript (no build process required)
- **Dependencies**: Leaflet 1.9.4, PapaParse 5.4.1 (loaded from CDN)
- **Storage**: Browser localStorage (~5MB limit)
- **Performance**: Optimized for 500+ households
- **Offline-first**: Works completely without internet after setup

## Development

### Running Locally
No server required - simply open `index.html` in a web browser.

### Testing
- Load CSV data with the 12-column format
- Test sorting options and resource filtering
- Verify data persistence after page refresh
- Test region/cluster management features

### Key Components
- **Dynamic column detection** for flexible CSV formats
- **Resource discovery** from text fields
- **Smart tile fallback** for offline mapping
- **Change tracking** with undo functionality

## Browser Compatibility

Works in all modern browsers. Requires JavaScript enabled and localStorage support.

## Contributing

This is a single-file application design for easy distribution. When making changes:
1. Maintain offline capability
2. Follow existing vanilla JavaScript patterns
3. Test with real CSV data
4. Preserve localStorage data integrity

## License

This project is for church/community use. Please respect the privacy of household data.