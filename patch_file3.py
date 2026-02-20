import re
with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's see if any other space is in the fetch urls
matches = re.finditer(r'apiFetch\(`[^`]+`\)', text)
for m in matches:
    print(m.group(0))

