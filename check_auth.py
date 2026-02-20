with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
print("checkAuth exists:", "checkAuth" in text)
print("apiFetch exists:", "apiFetch" in text)

match = re.search(r'function apiFetch\(.*?\}', text, re.DOTALL)
if match:
    print("apiFetch content:")
    print(match.group(0))
