import re
with open('public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace innerHTML in loadHistory so it escapes properly
text = text.replace('let url = `/api/quotes?status=${_histFilter.status}`', 'let url = `/api/quotes?status=${_histFilter.status}`;')

with open('public/admin/cotizador.html', 'w', encoding='utf-8') as f:
    f.write(text)
