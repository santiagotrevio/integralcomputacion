import os
import re
import json
import pdfplumber

def parse_invoices(input_dir):
    data = []
    
    for filename in os.listdir(input_dir):
        if not filename.endswith('.pdf'):
            continue
            
        path = os.path.join(input_dir, filename)
        try:
            with pdfplumber.open(path) as pdf:
                text = ""
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
                
                # Try extracting fields
                folio_match = re.search(r'FOLIO:\s*(\d+)', text, re.IGNORECASE)
                folio = folio_match.group(1) if folio_match else "S/N"
                
                fecha_match = re.search(r'FECHA DE EMISIÓN:\s*([\d-]+)', text)
                fecha = fecha_match.group(1) if fecha_match else ""
                
                # Client
                receptor_match = re.search(r'RECEPTOR:\s*\n([^\n]+)', text)
                if not receptor_match:
                    receptor_match = re.search(r'Cliente:\s*([^\n]+)', text)
                
                cliente = receptor_match.group(1).strip() if receptor_match else ""
                
                total_match = re.search(r'TOTAL\s+\$\s*([\d,.]+)', text)
                total = float(total_match.group(1).replace(',', '')) if total_match else 0.0
                
                # Products - naive extraction: lines with $ ... $
                products = []
                for line in text.split('\n'):
                    # e.g.: 1 Pieza TONER KËRPEN COMPATIBLE CB435A $ 270.00 $ 270.00
                    prod_match = re.match(r'^(\d+(?:\.\d+)?)\s+([A-Za-z]+)\s+(.+?)\s+\$\s*([\d,.]+)\s+\$\s*([\d,.]+)$', line.strip())
                    if prod_match:
                        products.append({
                            "qty": float(prod_match.group(1)),
                            "unit": prod_match.group(2),
                            "desc": prod_match.group(3).strip(),
                            "price": float(prod_match.group(4).replace(',','')),
                            "amount": float(prod_match.group(5).replace(',',''))
                        })
                
                data.append({
                    "file": filename,
                    "folio": folio,
                    "fecha": fecha,
                    "cliente": cliente,
                    "total": total,
                    "productos": products
                })
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            
    return data

if __name__ == '__main__':
    result = parse_invoices("/Users/santiago/Downloads/facturas")
    
    # Let's print summary
    print(f"Total processed: {len(result)}")
    print(f"Sample data:")
    for r in result[:3]:
        print(json.dumps(r, indent=2))
        
    # Save to JSON
    with open('/Users/santiago/Documents/GitHub/integralcomputacion/data/parsed_invoices.json', 'w') as f:
        json.dump(result, f, indent=2)
