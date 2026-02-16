import csv
import json
import os
import urllib.request
import time

# Function to download image
def download_image(url, filename):
    folder = "assets/images/products/toner"
    if not os.path.exists(folder):
        os.makedirs(folder)
    
    filepath = os.path.join(folder, filename)
    
    # If file already exists, don't download again
    if os.path.exists(filepath):
        return filepath
        
    try:
        # User requested real photos "buscando por donde sea", scraped URLs are direct from manufacturer/distributor
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'})
        with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
            out_file.write(response.read())
        print(f"Downloaded: {filename}")
        return filepath
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return "assets/images/products/toner/generic-box.png" # Fallback

# Load scraped data (Lexmark)
with open('assets/data/scraped_toners_lexmark.json', 'r') as f:
    products_data = json.load(f)

# Load Image Map (Lexmark)
try:
    with open('assets/data/lexmark_images_map.json', 'r') as f:
        image_map = json.load(f)
except FileNotFoundError:
    image_map = {}

# Process Lexmark products
formatted_products = []
for p in products_data:
    img_filename = f"lexmark-{p['sku'].lower()}.png"
    if p['sku'] in image_map:
        local_img_path = download_image(image_map[p['sku']], img_filename)
    else:
        local_img_path = "assets/images/products/toner/generic-box.png"
    
    formatted_products.append({
        "sku": p['sku'],
        "name": p['name'],
        "desc": p['description'] if p['description'] else "Disponible bajo pedido.",
        "img": local_img_path
    })

# Load scraped data (Canon)
try:
    with open('assets/data/scraped_toners_canon.json', 'r') as f:
        canon_data = json.load(f)
except FileNotFoundError:
    canon_data = []

# Load Image Map (Canon)
try:
    with open('assets/data/canon_images_map.json', 'r') as f:
        canon_image_map_list = json.load(f)
        # Convert list to dict for easier lookup if needed, or if it's already a dict use it processing
        # The file I wrote was a list of dicts [{"sku": "...", "img": "..."}]
        canon_image_map = {item['sku']: item['img'] for item in canon_image_map_list}
except FileNotFoundError:
    canon_image_map = {}

# Process Canon products
for p in canon_data:
    img_filename = f"canon-{p['sku'].lower()}.png"
    if p['sku'] in canon_image_map:
        local_img_path = download_image(canon_image_map[p['sku']], img_filename)
    else:
        # Fallback to generic, or we can try a direct search later
        local_img_path = "assets/images/products/toner/generic-box.png"
        
    formatted_products.append({
        "sku": p['sku'],
        "name": p['name'],
        "desc": p['description'] if p['description'] else "Disponible bajo pedido.",
        "img": local_img_path
    })

products_data = formatted_products

# Read existing products first to append (Videovigilancia items)
existing_products = []
try:
    with open('assets/data/productos.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            # ONLY keep products that are NOT 'toner' to refresh the catalog
            if row[1] != 'toner':
                existing_products.append(row)
except FileNotFoundError:
    header = ['id', 'category', 'name', 'description', 'image']

# Append new scraped Lexmark products
for p in products_data:
    existing_products.append([
        p['sku'],
        'toner', # Category
        p['name'],
        p['desc'],
        p['img']
    ])

# Write back
with open('assets/data/productos.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(existing_products)

print(f"Replaced toner catalog with {len(products_data)} real Lexmark products. Total products: {len(existing_products)}")
