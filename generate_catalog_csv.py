import csv
import random

products = []
categories = ['toner', 'papeleria', 'accesorios']
brands = ['HP', 'Brother', 'Canon', 'Epson', 'Logitech', 'Scribe', 'BIC', 'Dell']

# Images mapping
images = {
    'toner': 'assets/images/products/toner-generic.png',
    'papeleria': 'assets/images/products/paper-ream.png',
    'accesorios_mouse': 'assets/images/products/mouse-generic.png',
    'accesorios_keyboard': 'assets/images/products/keyboard-generic.png'
}

for i in range(1, 101):
    cat = random.choice(categories)
    brand = random.choice(brands)
    
    # Logic for image and name
    if cat == 'toner':
        model = f"{brand}-{random.randint(100, 999)}X"
        name = f"Tóner {brand} Modelo {model}"
        desc = "Cartucho de alto rendimiento, calidad premium. Compatible con impresoras láser."
        img = images['toner']
        code = f"T-{model}"
    elif cat == 'papeleria':
        items = ['Papel Bond', 'Plumas', 'Carpetas', 'Sobres']
        item = random.choice(items)
        name = f"{item} {brand} Paquete"
        desc = "Material de oficina esencial de alta calidad."
        img = images['papeleria']
        code = f"P-{brand[:3].upper()}-{random.randint(10,99)}"
    else: # accesorios
        items = ['Mouse', 'Teclado', 'Cable USB', 'Hub USB']
        item = random.choice(items)
        if item == 'Mouse':
            img = images['accesorios_mouse']
        elif item == 'Teclado':
            img = images['accesorios_keyboard']
        else:
            img = images['accesorios_mouse'] # fallback
            
        name = f"{item} {brand} Profesional"
        desc = "Ergonómico y duradero. Ideal para trabajo diario."
        code = f"A-{brand[:3].upper()}-{random.randint(100,999)}"

    products.append([code, cat, name, desc, img])

# Write CSV
with open('assets/data/productos.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['id', 'category', 'name', 'description', 'image']) # Header
    writer.writerows(products)

print("CSV Generated successfully with 100 products.")
