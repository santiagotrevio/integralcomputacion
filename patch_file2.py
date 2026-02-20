import re
with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()

# I see a double semicolon
text = text.replace('let url = `/api/quotes?status=${_histFilter.status}`;;', 'let url = `/api/quotes?status=${_histFilter.status}`;')

with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'w', encoding='utf-8') as f:
    f.write(text)
