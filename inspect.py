import re
with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()

print("Is there any spaced fetching string like `/api/quotes ? status` ?")
print(bool(re.search(r'`/api/quotes \? status =', text)))
print("What about `status=` ?")
print(bool(re.search(r'`/api/quotes\?status=', text)))
print("Show me the lines:")
matches = re.finditer(r'.*api/quotes\?status.*', text)
for m in matches:
    print(m.group(0))
