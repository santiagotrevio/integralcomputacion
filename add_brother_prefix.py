import json
import os

# Files to update
scraped_file = 'assets/data/scraped_toners_brother.json'
map_file = 'assets/data/brother_images_map.json'

def add_prefix(sku):
    if not sku.startswith('BR'):
        return f"BR{sku}"
    return sku

# 1. Update scraped products
with open(scraped_file, 'r') as f:
    products = json.load(f)

updated_products = []
for p in products:
    old_sku = p['sku']
    new_sku = add_prefix(old_sku)
    p['sku'] = new_sku
    updated_products.append(p)

with open(scraped_file, 'w') as f:
    json.dump(updated_products, f, indent=4)

print(f"Updated {len(updated_products)} products in {scraped_file} with BR prefix.")

# 2. Update image map
with open(map_file, 'r') as f:
    img_map = json.load(f)

updated_map = []
for item in img_map:
    old_sku = item['sku']
    new_sku = add_prefix(old_sku)
    item['sku'] = new_sku
    updated_map.append(item)

with open(map_file, 'w') as f:
    json.dump(updated_map, f, indent=4)

print(f"Updated {len(updated_map)} items in {map_file} with BR prefix.")
