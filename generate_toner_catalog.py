import csv
import json
import os

# Load scraped data
with open('assets/data/scraped_toners.json', 'r') as f:
    products_data = json.load(f)

# Normalize keys for CSV mapping (the JSON has 'image_url', CSV needs 'img' or similar)
formatted_products = []
for p in products_data:
    formatted_products.append({
        "sku": p['sku'],
        "name": p['name'],
        "desc": p['description'] if p['description'] else "Disponible bajo pedido.",
        "img": p['image_url']
    })

products_data = formatted_products

# Read existing products first to append (Videovigilancia items)
existing_products = []
try:
    with open('assets/data/productos.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            existing_products.append(row)
except FileNotFoundError:
    header = ['id', 'category', 'name', 'description', 'image']

# Append new products (checking for duplicates by SKU to be safe)
existing_skus = [row[0] for row in existing_products]

count_added = 0
for p in products_data:
    if p['sku'] not in existing_skus:
        existing_products.append([
            p['sku'],
            'toner', # Category
            p['name'],
            p['desc'],
            p['img']
        ])
        count_added += 1

# Write back
with open('assets/data/productos.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(existing_products)

print(f"Added {count_added} toner products. Total products: {len(existing_products)}")
