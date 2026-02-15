import csv
import os

# Define the local path for toner images
# We just generated: hp-box.png, brother-box.png, canon-ink.png, generic-box.png
# in assets/images/products/toner/

products_data = [
    # HP Toners (Using HP Box)
    {"sku": "CE285A", "name": "Tóner Compatible HP 85A", "desc": "Cartucho de tóner negro compatible para impresoras HP LaserJet P1102, M1132, M1212. Alto rendimiento.", "img": "assets/images/products/toner/hp-box.png"},
    {"sku": "CF248A", "name": "Tóner Compatible HP 48A", "desc": "Tóner negro compatible para series HP LaserJet Pro M15, M15w, MFP M28. Rendimiento estándar.", "img": "assets/images/products/toner/hp-box.png"},
    {"sku": "CF217A", "name": "Tóner Compatible HP 17A", "desc": "Cartucho compatible con chip para HP LaserJet Pro M102, MFP M130 series.", "img": "assets/images/products/toner/hp-box.png"},
    {"sku": "Q2612A", "name": "Tóner Compatible HP 12A", "desc": "El clásico 12A compatible. Para impresoras HP 1010, 1012, 1020, 3015. Alta durabilidad.", "img": "assets/images/products/toner/hp-box.png"},
    {"sku": "CF283A", "name": "Tóner Compatible HP 83A", "desc": "Compatible para HP LaserJet Pro M127, M125, M201, M225. Calidad de impresión nítida.", "img": "assets/images/products/toner/hp-box.png"},
    {"sku": "W1105A", "name": "Tóner Compatible HP 105A", "desc": "Cartucho sin chip (o con chip según stock) para HP Laser 107, 135, 137 series.", "img": "assets/images/products/toner/hp-box.png"},
    {"sku": "CF400A", "name": "Tóner Compatible HP 201A Negro", "desc": "Tóner negro para impresoras color M252, MFP M277. Colores vivos y precisos.", "img": "assets/images/products/toner/hp-box.png"},
    
    # Brother (Using Brother Box)
    {"sku": "TN-1060", "name": "Tóner Compatible Brother TN-1060", "desc": "Cartucho negro compatible para Brother HL-1110, 1112, DCP-1512, MFC-1810.", "img": "assets/images/products/toner/brother-box.png"},
    {"sku": "TN-660", "name": "Tóner Compatible Brother TN-660", "desc": "Tóner de alto rendimiento para series HL-L2300, L2340, L2360, L2380. Hasta 2600 páginas.", "img": "assets/images/products/toner/brother-box.png"},
    {"sku": "TN-760", "name": "Tóner Compatible Brother TN-760", "desc": "Cartucho para impresoras HL-L2350DW, L2390DW, L2395DW, L2370DW. Con chip.", "img": "assets/images/products/toner/brother-box.png"},
    {"sku": "DR-1060", "name": "Tambor (Drum) Compatible Brother DR-1060", "desc": "Unidad de tambor compatible con TN-1060. Vida útil aproximada de 10,000 páginas.", "img": "assets/images/products/toner/brother-box.png"},

    # Canon / Ink (Using Ink Bottle)
    {"sku": "GI-190-BK", "name": "Botella de Tinta Canon GI-190 Negra", "desc": "Tinta original para sistema continuo Canon Pixma G2100, G3100, G4100. Contenido 135ml.", "img": "assets/images/products/toner/canon-ink.png"},
    {"sku": "GI-190-C", "name": "Botella de Tinta Canon GI-190 Cian", "desc": "Tinta azul (Cyan) original para Canon serie G. Colores vibrantes y duraderos.", "img": "assets/images/products/toner/canon-ink.png"},
    {"sku": "GI-190-M", "name": "Botella de Tinta Canon GI-190 Magenta", "desc": "Tinta rosa (Magenta) original para Canon serie G. Calidad fotográfica.", "img": "assets/images/products/toner/canon-ink.png"},
    {"sku": "GI-190-Y", "name": "Botella de Tinta Canon GI-190 Amarilla", "desc": "Tinta amarilla (Yellow) original para Canon serie G. Secado rápido.", "img": "assets/images/products/toner/canon-ink.png"},
    {"sku": "T544", "name": "Tinta Epson 544 Negra Original", "desc": "Botella EcoTank original Epson T544 para L3110, L3150. Impresiones nítidas.", "img": "assets/images/products/toner/canon-ink.png"}, # Reusing ink layout for now

    # Generic
    {"sku": "CF540A", "name": "Tóner Compatible HP 203A Negro", "desc": "Compatible premium para Color LaserJet Pro M254, MFP M281.", "img": "assets/images/products/toner/generic-box.png"},
    {"sku": "CF541A", "name": "Tóner Compatible HP 203A Cian", "desc": "Tóner color cian de alta calidad para serie M254/M281.", "img": "assets/images/products/toner/generic-box.png"},
    {"sku": "W700", "name": "Tóner Xerox 3020 Generico", "desc": "Cartucho genérico compatible con Xerox Phaser 3020 y WorkCentre 3025.", "img": "assets/images/products/toner/generic-box.png"},
    {"sku": "106R02773", "name": "Tóner Xerox 3020 Original", "desc": "Tóner original Xerox de capacidad estándar. Garantía de fábrica.", "img": "assets/images/products/toner/generic-box.png"}
]

# Read existing products first to append
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
