#!/usr/bin/env python3
"""
Ward Map Tile Downloader
Downloads map tiles for offline use - both street and satellite views
"""

import os
import time
import requests
from math import floor, ceil, log, tan, pi, cos
import csv

# Configuration
MOCKSVILLE_BOUNDS = {
    'north': 36.0,   # Adjust based on your ward
    'south': 35.8,
    'east': -80.35,
    'west': -80.55
}

MIN_ZOOM = 7
MAX_ZOOM = 16

# Tile servers
SERVERS = {
    'osm': 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'satellite': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
}

def lat_to_tile(lat, zoom):
    """Convert latitude to tile number"""
    return floor((1 - log(tan(lat * pi / 180) + 1 / cos(lat * pi / 180)) / pi) / 2 * (2 ** zoom))

def lon_to_tile(lon, zoom):
    """Convert longitude to tile number"""
    return floor((lon + 180) / 360 * (2 ** zoom))

def get_bounds_from_csv(csv_file):
    """Extract bounds from ward CSV file"""
    lats, lons = [], []
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['Latitude'] and row['Longitude']:
                    lats.append(float(row['Latitude']))
                    lons.append(float(row['Longitude']))
        
        if lats and lons:
            return {
                'north': max(lats) + 0.01,  # Add padding
                'south': min(lats) - 0.01,
                'east': max(lons) + 0.01,
                'west': min(lons) - 0.01
            }
    except Exception as e:
        print(f"Could not read CSV: {e}")
    
    return MOCKSVILLE_BOUNDS

def get_tiles_for_households(household_locations, bounds):
    """Calculate which tiles actually contain households"""
    required_tiles = set()
    
    for zoom in range(MIN_ZOOM, MAX_ZOOM + 1):
        if zoom <= 10:
            # For overview levels, download ALL tiles in bounds
            # This ensures navigation works even with distant outliers
            x_min = lon_to_tile(bounds['west'], zoom)
            x_max = lon_to_tile(bounds['east'], zoom)
            y_min = lat_to_tile(bounds['north'], zoom)
            y_max = lat_to_tile(bounds['south'], zoom)
            
            for x in range(x_min, x_max + 1):
                for y in range(y_min, y_max + 1):
                    required_tiles.add((zoom, x, y))
        else:
            # For detail levels, only download near households
            for lat, lon in household_locations:
                x = lon_to_tile(lon, zoom)
                y = lat_to_tile(lat, zoom)
                
                # Add the tile containing this household
                required_tiles.add((zoom, x, y))
                
                # Add surrounding tiles based on zoom
                if zoom == 13:
                    for dx in [-1, 0, 1]:
                        for dy in [-1, 0, 1]:
                            required_tiles.add((zoom, x + dx, y + dy))
                elif zoom == 14:
                    # Less padding at medium zoom
                    for dx in [-1, 0, 1]:
                        for dy in [-1, 0, 1]:
                            if abs(dx) + abs(dy) <= 1:  # Only adjacent, not diagonal
                                required_tiles.add((zoom, x + dx, y + dy))
                # At max zoom (15-16), only download exact tiles
    
    return required_tiles

def download_tile(url, filepath, retries=3):
    """Download a single tile with retry logic"""
    for attempt in range(retries):
        try:
            headers = {'User-Agent': 'WardMapOffline/1.0'}
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                return True
            elif response.status_code == 404:
                return False  # Tile doesn't exist
        except Exception as e:
            if attempt == retries - 1:
                print(f"Failed to download {url}: {e}")
        time.sleep(0.5 * (attempt + 1))  # Progressive delay
    return False

def get_tiles_for_households(household_locations, bounds):
    """Calculate which tiles actually contain households"""
    required_tiles = set()
    
    for zoom in range(MIN_ZOOM, MAX_ZOOM + 1):
        for lat, lon in household_locations:
            x = lon_to_tile(lon, zoom)
            y = lat_to_tile(lat, zoom)
            
            # Add the tile containing this household
            required_tiles.add((zoom, x, y))
            
            # For lower zoom levels, add surrounding tiles for context
            if zoom <= 13:
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        required_tiles.add((zoom, x + dx, y + dy))
            elif zoom == 14:
                # Less padding at medium zoom
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        if abs(dx) + abs(dy) <= 1:  # Only adjacent, not diagonal
                            required_tiles.add((zoom, x + dx, y + dy))
            # At max zoom (15-16), only download exact tiles
    
    return required_tiles

def download_tiles(bounds, output_dir='tiles', household_locations=None):
    """Download tiles - only where households exist if locations provided"""
    
    total_tiles = 0
    downloaded = 0
    failed = 0
    skipped = 0
    
    # Get required tiles if household locations provided
    required_tiles = None
    if household_locations:
        required_tiles = get_tiles_for_households(household_locations, bounds)
        print(f"📊 Smart mode: {len(required_tiles)} tiles needed per map type")
    
    for map_type, url_template in SERVERS.items():
        print(f"\n📍 Downloading {map_type} tiles...")
        
        for zoom in range(MIN_ZOOM, MAX_ZOOM + 1):
            # Calculate full bounds for reference
            x_min = lon_to_tile(bounds['west'], zoom)
            x_max = lon_to_tile(bounds['east'], zoom)
            y_min = lat_to_tile(bounds['north'], zoom)
            y_max = lat_to_tile(bounds['south'], zoom)
            
            tiles_at_zoom = 0
            if required_tiles:
                # Count only required tiles at this zoom
                tiles_at_zoom = sum(1 for z, x, y in required_tiles if z == zoom)
                print(f"  Zoom {zoom}: {tiles_at_zoom} tiles (skipping empty areas)")
            else:
                tiles_at_zoom = (x_max - x_min + 1) * (y_max - y_min + 1)
                print(f"  Zoom {zoom}: {tiles_at_zoom} tiles")
            
            for x in range(x_min, x_max + 1):
                for y in range(y_min, y_max + 1):
                    # Skip if not in required tiles
                    if required_tiles and (zoom, x, y) not in required_tiles:
                        skipped += 1
                        continue
                    
                    total_tiles += 1
                    
                    # Build file path
                    if map_type == 'satellite':
                        # ArcGIS uses different order
                        filepath = f"{output_dir}/{map_type}/{zoom}/{y}/{x}.png"
                        url = url_template.format(z=zoom, y=y, x=x)
                    else:
                        filepath = f"{output_dir}/{map_type}/{zoom}/{x}/{y}.png"
                        url = url_template.format(z=zoom, x=x, y=y)
                    
                    # Skip if already exists
                    if os.path.exists(filepath):
                        print(f"    ✓ Exists: {filepath}", end='\r')
                        downloaded += 1
                        continue
                    
                    # Download
                    print(f"    ⬇ Downloading: z{zoom}/{x}/{y}", end='\r')
                    if download_tile(url, filepath):
                        downloaded += 1
                    else:
                        failed += 1
                    
                    # Rate limiting
                    time.sleep(0.2)  # Be respectful to tile servers
    
    print(f"\n\n✅ Download complete!")
    print(f"   Downloaded: {downloaded} tiles")
    print(f"   Failed: {failed}")
    print(f"   Skipped (empty areas): {skipped}")
    
    # Calculate size
    total_size = 0
    for root, dirs, files in os.walk(output_dir):
        for file in files:
            total_size += os.path.getsize(os.path.join(root, file))
    
    print(f"   Total size: {total_size / (1024*1024):.1f} MB")

def main():
    print("🗺️  Ward Map Tile Downloader")
    print("="*40)
    
    # Check for CSV file
    csv_file = 'ward_data.csv'
    household_locations = []
    
    if os.path.exists(csv_file):
        print(f"📄 Found {csv_file}, extracting bounds...")
        bounds = get_bounds_from_csv(csv_file)
        
        # Also collect household locations for smart downloading
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['Latitude'] and row['Longitude']:
                        household_locations.append((
                            float(row['Latitude']), 
                            float(row['Longitude'])
                        ))
            print(f"📍 Found {len(household_locations)} household locations")
        except Exception as e:
            print(f"Warning: Could not read household locations: {e}")
    else:
        print(f"⚠️  No {csv_file} found, using default Mocksville bounds")
        bounds = MOCKSVILLE_BOUNDS
    
    print(f"📍 Area bounds:")
    print(f"   North: {bounds['north']:.4f}")
    print(f"   South: {bounds['south']:.4f}")
    print(f"   East:  {bounds['east']:.4f}")
    print(f"   West:  {bounds['west']:.4f}")
    
    # Estimate download
    if household_locations:
        # Smart estimate based on actual household locations
        required = get_tiles_for_households(household_locations, bounds)
        total_est = len(required) * 2  # Both map types
        print(f"\n📊 Smart download: ~{total_est} tiles (~{total_est * 0.05:.1f} MB)")
        print(f"   Full coverage for zoom 11-12 (navigation)")
        print(f"   Household areas only for zoom 13-16 (detail)")
    else:
        # Full area estimate
        total_est = 0
        for zoom in range(MIN_ZOOM, MAX_ZOOM + 1):
            x_min = lon_to_tile(bounds['west'], zoom)
            x_max = lon_to_tile(bounds['east'], zoom)
            y_min = lat_to_tile(bounds['north'], zoom)
            y_max = lat_to_tile(bounds['south'], zoom)
            tiles = (x_max - x_min + 1) * (y_max - y_min + 1)
            total_est += tiles * 2  # Both map types
        print(f"\n📊 Estimated: ~{total_est} tiles (~{total_est * 0.05:.1f} MB)")
    
    print(f"   This will take approximately {total_est * 0.2 / 60:.0f} minutes")
    
    response = input("\nProceed with download? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        return
    
    download_tiles(bounds, household_locations=household_locations)
    print("\n✅ Done! Your offline map tiles are ready.")
    print("📁 Place the 'tiles' folder in the same directory as index.html")

if __name__ == "__main__":
    main()
