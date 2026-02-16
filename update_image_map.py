import json
import urllib.request
import os

# Load existing map
try:
    with open('assets/data/lexmark_images_map.json', 'r') as f:
        image_map = json.load(f)
except FileNotFoundError:
    image_map = {}

# Batch 2 Findings (Manually confirmed)
batch2 = {
  "B224H00": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-B224H00-1.jpg",
  "50F0Z00": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-50F0Z00-1.jpg",
  "20N40C0": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-20N40C0-1.jpg",
  "58D4H00": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-58D4H00-1.jpg",
  "60F4000": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-60F4000-1.jpg",
  "78C40K0": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-78C40K0-1.jpg",
  "78C40C0": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-78C40C0-1.jpg",
  "78C40M0": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-78C40M0-1.jpg",
  "78C40Y0": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-78C40Y0-1.jpg",
  "80C8SY0": "https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-80C8SY0-1.jpg"
}

image_map.update(batch2)

# Load Scraped Products to find missing ones
with open('assets/data/scraped_toners_lexmark.json', 'r') as f:
    products = json.load(f)

print("Checking remaining items and constructing map...")

# Auto-generate or check for remaining
for p in products:
    sku = p['sku']
    if sku not in image_map:
        # Try Cyberpuerta Pattern
        url = f"https://www.cyberpuerta.mx/img/product/L/CP-LEXMARK-{sku}-1.jpg"
        
        # Verify if it exists (Head request equivalent)
        try:
            req = urllib.request.Request(url, method='HEAD')
            req.add_header('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36')
            
            # Using verify context
            with urllib.request.urlopen(req, timeout=3) as response:
                if response.status == 200:
                    print(f"Adding auto-generated URL for {sku}: {url}")
                    image_map[sku] = url
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"Pattern failed for {sku} (404 Not Found)")
            else:
                print(f"Error {e.code} for {sku}")
        except Exception as e:
            print(f"Unexpected error checking {sku}: {e}")

# Save updated map
with open('assets/data/lexmark_images_map.json', 'w') as f:
    json.dump(image_map, f, indent=2)

print(f"Map updated. Total mapped items: {len(image_map)}")
