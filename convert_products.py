
import csv
import json
import os

csv_path = 'assets/data/productos.csv'
js_path = 'assets/js/productos.js'

data = []

# Ensure js directory exists
os.makedirs(os.path.dirname(js_path), exist_ok=True)

try:
    with open(csv_path, mode='r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # Clean up keys/values
            clean_row = {
                'id': row['id'].strip() if row['id'] else '',
                'category': row['category'].strip() if row['category'] else '',
                'name': row['name'].strip() if row['name'] else '',
                'description': row['description'].strip() if row['description'] else '',
                'image': row['image'].strip() if row['image'] else ''
            }
            data.append(clean_row)

    # Write JS file
    with open(js_path, mode='w', encoding='utf-8') as jsfile:
        jsfile.write("// Base de datos de productos (Generado automáticamente)\n")
        jsfile.write("const productsDB = ")
        json.dump(data, jsfile, ensure_ascii=False, indent=2)
        jsfile.write(";\n")

    print(f"Successfully converted {len(data)} products to {js_path}")

except Exception as e:
    print(f"Error: {e}")
