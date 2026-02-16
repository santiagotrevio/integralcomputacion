import json

# Files to update
scraped_file = 'assets/data/scraped_toners_lexmark.json'
map_file = 'assets/data/lexmark_images_map.json'

def add_prefix(sku):
    if not sku.startswith('LX'):
        return f"LX{sku}"
    return sku

# 1. Update scraped products
try:
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
        
    print(f"Updated {len(updated_products)} products in {scraped_file} with LX prefix.")

except Exception as e:
    print(f"Error processing {scraped_file}: {e}")


# 2. Update image map (Dict format)
try:
    with open(map_file, 'r') as f:
        img_map = json.load(f)

    updated_map = {}
    for sku, url in img_map.items():
        new_sku = add_prefix(sku)
        updated_map[new_sku] = url

    with open(map_file, 'w') as f:
        json.dump(updated_map, f, indent=2) # Using indent 2 for readability

    print(f"Updated {len(updated_map)} items in {map_file} with LX prefix.")

except Exception as e:
    print(f"Error processing {map_file}: {e}")
