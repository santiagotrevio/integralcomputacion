import csv
import os
import shutil

# Paths
base_dir = '/Users/santiago/Documents/GitHub/integralcomputacion'
checklist_csv_path = os.path.join(base_dir, 'Check list productos.csv')
products_csv_path = os.path.join(base_dir, 'assets/data/productos.csv')
toner_img_dir = os.path.join(base_dir, 'assets/images/products/toner')

# Read Checklist mappings
corrections = {} # { 'current_code': 'correct_code' }

try:
    with open(checklist_csv_path, 'r', encoding='latin-1') as f: # Try latin-1 for the special chars
        reader = csv.reader(f)
        headers = next(reader)
        # Find indices (flexible search)
        idx_current = -1
        idx_correct = -1
        
        for i, h in enumerate(headers):
            if "Actual" in h: idx_current = i
            if "Correcto" in h: idx_correct = i
            
        if idx_current == -1 or idx_correct == -1:
            print("Error: Could not identify mapping columns in checklist CSV.")
            exit()
            
        for row in reader:
            if len(row) > max(idx_current, idx_correct):
                current_code = row[idx_current].strip()
                correct_code = row[idx_correct].strip()
                
                if current_code and correct_code and current_code != correct_code:
                    corrections[current_code] = correct_code
except Exception as e:
    print(f"Error reading checklist: {e}")
    exit()

print(f"Found {len(corrections)} corrections to apply.")

# Read Products
products = []
with open(products_csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        products.append(row)

updated_count = 0

for product in products:
    current_id = product['id'].strip()
    
    # Check if this ID needs correction
    if current_id in corrections:
        new_id = corrections[current_id]
        
        print(f"Correcting: {current_id} -> {new_id}")
        
        # Update ID
        product['id'] = new_id
        
        # Image Handling
        # 1. Determine old image path (from CSV or guess)
        old_img_rel_path = product['image']
        old_img_filename = os.path.basename(old_img_rel_path)
        
        # 2. Determine new image filename
        # Preserve extension from old file if possible, else default to .png
        ext = os.path.splitext(old_img_filename)[1]
        if not ext: ext = ".png"
        
        new_img_filename = f"{new_id}{ext}" # e.g. LX56F4U00.png
        # Note: we are NOT prefixing with brand here, per user instruction: "ID is same as image name"
        # Unless the Checklist implies a prefix? "LX56F4U00" implies Lexmark prefix is part of code.
        
        new_img_rel_path = f"assets/images/products/toner/{new_img_filename}"
        
        # 3. Rename physical file if it exists
        old_img_full_path = os.path.join(toner_img_dir, old_img_filename)
        # Also try "brand-id.png" if the CSV had that style
        
        # If old file exists, rename it
        if os.path.exists(old_img_full_path):
            new_img_full_path = os.path.join(toner_img_dir, new_img_filename)
            shutil.move(old_img_full_path, new_img_full_path)
            # print(f"  Renamed image: {old_img_filename} -> {new_img_filename}")
        else:
            # Maybe the old file was named differently?
            # Start search...
            pass 
            
        # Update CSV image path
        product['image'] = new_img_rel_path
        updated_count += 1

# Write updated CSV
if updated_count > 0:
    with open(products_csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(products)
    print(f"SUCCESS: Applied {updated_count} corrections.")
else:
    print("No corrections needed (IDs matched or not found).")
