with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()
    
# En el historial general hay un vendor que dice `Usuario ${q.user_id} ` al final de un backtick.
text = text.replace('`Usuario ${q.user_id} `', '`Usuario ${q.user_id}`')
text = text.replace('`Usuario ${q.user_id} `', '`Usuario ${q.user_id}`') # en caso de varios

# En statusBadge hay comillas sueltas
# Fix `<span style...` inside clientQuotes Panel
text = text.replace('< span style', '<span style')

with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'w', encoding='utf-8') as f:
    f.write(text)
