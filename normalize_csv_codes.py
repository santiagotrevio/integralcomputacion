import csv
import os
import shutil

# Paths
base_dir = '/Users/santiago/Documents/GitHub/integralcomputacion'
csv_path = os.path.join(base_dir, 'assets/data/productos.csv')
checklist_dir = os.path.join(base_dir, 'CHECK LIST PRODUCTOS PAGINA')
toner_img_dir = os.path.join(base_dir, 'assets/images/products/toner')

# Ensure target directory exists
os.makedirs(toner_img_dir, exist_ok=True)

# Read CSV to memory
products = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        products.append(row)

# Get Correct Codes from Check List Files
# Map: { normalized_code: { 'original_filename': 'Code.png', 'correct_code': 'Code' } }
correct_codes_map = {}
try:
    files = os.listdir(checklist_dir)
    for filename in files:
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            root, ext = os.path.splitext(filename)
            correct_code = root # This is the "Correct Code"
            normalized = root.lower().replace("-", "").replace("_", "").strip()
            correct_codes_map[normalized] = {
                'filename': filename,
                'correct_code': correct_code,
                'ext': ext
            }
except FileNotFoundError:
    print(f"Error: Checklist directory not found.")
    exit()

updated_count = 0

# Iterate CSV and update
for product in products:
    current_id = product['id']
    # Normalize current ID for matching
    norm_id = current_id.lower().replace("-", "").replace("_", "").strip()
    
    # Try to find a match in our Correct Codes Map
    # We check if the ID appears in the filename, or filename appears in ID
    
    match = None
    
    # Direct match
    if norm_id in correct_codes_map:
        match = correct_codes_map[norm_id]
    else:
        # Heuristic match: check strictly if key is substring of ID or vice versa, 
        # but matching specific parts like 'TN433BK' vs 'BRTN433BK'.
        # Actually user said "Correct code is the name of the image".
        # So 'BRTN433BK.png' -> Code 'BRTN433BK'.
        # If current ID is 'TN433BK', we might miss it.
        # But looking at previous CSV content, IDs are already like 'BRTN433BK'.
        
        # Let's try flexible suffix/prefix matching
        for key, data in correct_codes_map.items():
            # If the correct code (e.g. BRTN880) contains the CSV ID (TN880) or vice versa?
            # Actually CSV IDs are mostly accurate to the brand prefix now.
            # Let's trust exact normalized match first, if not, try contains.
            if key in norm_id or norm_id in key:
                 # Be careful not to match 'TN433' to 'TN433BK' (Black) incorrectly if multiple exist
                 # So we prefer exact match. 
                 pass

    if match:
        correct_code = match['correct_code'] # Capitalization from filename
        filename = match['filename']
        ext = match['ext']
        
        # Update CSV Data
        if product['id'] != correct_code:
            # print(f"Updating ID: {product['id']} -> {correct_code}")
            product['id'] = correct_code
            
        # Always update Image path to match the Correct Code
        new_image_name = f"{correct_code}{ext}" # e.g. BRTN433BK.png
        target_path = os.path.join(toner_img_dir, new_image_name)
        src_path = os.path.join(checklist_dir, filename)
        
        # Copy image
        shutil.copy2(src_path, target_path)
        
        # Update CSV Image Field
        new_rel_path = f"assets/images/products/toner/{new_image_name}"
        product['image'] = new_rel_path
        
        updated_count += 1

# Write back to CSV
if updated_count > 0:
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(products)
    print(f"SUCCESS: Normalize {updated_count} products in CSV to match Checklist filenames.")
else:
    print("No matching products found to normalize.")
