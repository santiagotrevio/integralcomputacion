import csv
import json
import os
import urllib.request
import time

# Directory for images
image_dir = "assets/images/products/video"
os.makedirs(image_dir, exist_ok=True)

# List of real products scraped from Memomedia (Videovigilancia)
# Note: Image URLs are direct from Memomedia CDN but we will download them locally.
products_data = [
  {
    "name": "Cámara DAHUA Bullet de 5 Megapixeles / Lente 2.8mm",
    "sku": "DH-HAC-B2A51N-0280B-S2",
    "description": "Cámara Bullet de 5 Megapixeles con lente de 2.8mm, ángulo de visión 106 grados, IR de 20 Mts, protección IP67, carcasa metálica, compatible con CVI/CVBS/AHD/TVI.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107199_dh-hac-b2a51n-0280b-s2.png"
  },
  {
    "name": "Cámara DAHUA Domo 1080p Metálica",
    "sku": "DH-HAC-HDW1200MN-0280B-S4",
    "description": "Cámara Domo 1080p con lente de 2.8mm, 101 grados de apertura, IR de 30 metros, protección IP67, DWDR, compatible con HDCVI/TVI/AHD/CBVS.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107117_dh-hac-hdw1200mn-0280b-s4.png"
  },
  {
    "name": "Cámara DAHUA Bullet 4K con Micrófono Integrado",
    "sku": "DH-HAC-HFW1801RN-0280B-S2",
    "description": "Cámara Bullet 4K (8 Megapixeles) con micrófono integrado, lente 2.8mm, WDR Real, IR de 30 Mts, protección IP67, construcción metálica.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107142_dh-hac-hfw1801rn-0280b-s2.png"
  },
  {
    "name": "Cámara DAHUA Bullet 5 Megapixeles Económica",
    "sku": "DH-HAC-B1A51N-0280B",
    "description": "Cámara Bullet de 5 Megapixeles, lente de 2.8 mm, 106 grados de apertura, IR de 20 Mts, protección IP67, compatible con múltiples formatos (CVI/CVBS/AHD/TVI).",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107198_dh-hac-b1a51n-0280_b.png"
  },
  {
    "name": "Cámara Bullet DAHUA 5 Megapixeles IR 80m",
    "sku": "DH-HAC-HFW1500DN-0360B-S2",
    "description": "Cámara Bullet de 5 Megapixeles con lente de 3.6mm, ángulo de visión 92 grados, largo alcance IR de 80 Mts, protección IP67, metálica.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107122_dh-hac-hfw1500dn-0360b-s2.png"
  },
  {
    "name": "Cámara DAHUA Bullet Full Color 1080p con Micrófono",
    "sku": "DH-HAC-HFW1239TN-A-LED-0280B-S2",
    "description": "Cámara Bullet con tecnología Full Color 1080p, visión nocturna en color (Luz Blanca 20 Mts), micrófono integrado, lente 2.8mm, protección IP67.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107125_dh-hac-hfw1239tn-a-led-0280b-s2.png"
  },
  {
    "name": "Cámara DAHUA Bullet HDCVI 1080p 3.6mm",
    "sku": "DH-HAC-HFW1200RN-0360B-S4",
    "description": "Cámara Bullet HDCVI 1080p metálica, lente de 3.6mm, ángulo de visión 87.5 grados, IR de 20 metros, protección IP67, soporte multi-formato.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107120_dh-hac-hfw1200rn-0360b-s4.png"
  },
  {
    "name": "Cámara DAHUA Domo 1080p IR 20m",
    "sku": "DH-HAC-HDW1200RN-0280B-S5",
    "description": "Cámara Domo 1080p con lente 2.8 mm, 103 grados de apertura, IR de 20 Mts, DWDR, diseño compacto para interiores y exteriores protegidos.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107107_dh-hac-hdw1200rn-0280b-s5.png"
  },
  {
    "name": "Cámara DAHUA Domo 1080p Metálica 3.6mm",
    "sku": "DH-HAC-HDW1200MN-0360B-S4",
    "description": "Cámara Domo 1080p con carcasa metálica, lente de 3.6mm, IR de 20 metros, protección IP67, DWDR, compatible con HDCVI/TVI/AHD/CBVS.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107106_dh-hac-hdw1200mn-0360b-s4.png"
  },
  {
    "name": "Cámara DAHUA Domo 5 Megapixeles con Micrófono",
    "sku": "DH-HAC-HDW1500EM-A-0280B-S2",
    "description": "Cámara Domo de 5 Megapixeles con micrófono integrado, lente 2.8mm, ángulo de visión 111 grados, potente IR de 50 Mts, protección IP67, metálica.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107111_dh-hac-hdw1500em-a-0280b-s2.png"
  },
  {
    "name": "Cámara DAHUA Domo Full Color 1080p con Micrófono",
    "sku": "DH-HAC-HDW1239TN-A-LED-0280B-S2",
    "description": "Cámara Domo Full Color de 2 Megapixeles, visión color 24/7 (Luz Blanca 20 Mts), micrófono integrado, lente 2.8mm, construcción metálica.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107119_dh-hac-hdw1239tn-a-led-0280b-s2.png"
  },
  {
    "name": "Cámara DAHUA Domo Full Color Instalación Rápida",
    "sku": "DH-HAC-HDW1239T-S-LED-0280B-S2",
    "description": "Cámara Domo Full Color 1080p diseñada para instalación rápida, visión color 24/7, lente 2.8mm, soporte Starlight y protección IP67.",
    "image_url": "https://memomedia.com.mx/storage/2024/July/week4/1107118_dh-hac-hdw1239t-s-led-0280b-s2.png"
  }
]

# Helper to download image
def download_image(url, filename):
    try:
        urllib.request.urlretrieve(url, filename)
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

# Generate CSV rows
csv_rows = []
for p in products_data:
    # Clean filename from SKU
    safe_sku = p['sku'].replace('/', '-').replace(' ', '_').lower()
    img_filename = f"{image_dir}/{safe_sku}.png"
    
    # Check if download is needed
    print(f"Downloading image for {p['sku']}...")
    if download_image(p['image_url'], img_filename):
        local_path = img_filename
    else:
        local_path = ""
    
    # Fallback to generic images if download failed
    if not local_path:
        kind = 'bullet' if 'Bullet' in p['name'] else 'dome'
        local_path = f"assets/images/products/video/camera-{kind}.png"

    csv_rows.append([
        p['sku'],
        'accesorios', 
        p['name'], 
        p['description'],
        local_path
    ])
    
    time.sleep(0.5) 

# Write CSV
csv_file = 'assets/data/productos.csv'
with open(csv_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['id', 'category', 'name', 'description', 'image'])
    writer.writerows(csv_rows)

print(f"Successfully generated {csv_file} with {len(csv_rows)} REAL products.")
