import re

with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix `< div` -> `<div`
text = text.replace('< div', '<div')
# Fix `</ div >` -> `</div>`
text = text.replace('</ div >', '</div>')
text = text.replace('</div >', '</div>')
# Fix `< p` -> `<p`
text = text.replace('< p ', '<p ')
text = text.replace('</ p >', '</p>')
# Fix `< span` -> `<span`
text = text.replace('< span', '<span')
text = text.replace('</ span >', '</span>')
text = text.replace('</span >', '</span>')
# Fix `< button` -> `<button`
text = text.replace('< button', '<button')
text = text.replace('</ button >', '</button>')
text = text.replace('</button >', '</button>')
# Fix `< !--` -> `<!--`
text = text.replace('< !--', '<!--')

# Fix attributes spacing
text = text.replace('style = "', 'style="')
text = text.replace('onclick = "', 'onclick="')
text = text.replace('title = "', 'title="')
text = text.replace('z - index: ', 'z-index: ')
text = text.replace('z - index: 10', 'z-index: 10')
text = text.replace('z-index: 10', 'z-index:10')
text = text.replace('align - items', 'align-items')
text = text.replace('flex - direction', 'flex-direction')
text = text.replace('margin - bottom', 'margin-bottom')

# Fix apiFetch URLs
text = text.replace('/ api / quotes ? status = active & clientName=${nameParam} ', '/api/quotes?status=active&clientName=${nameParam}')
text = text.replace('/ api / quotes ? status = archived & clientName=${nameParam} ', '/api/quotes?status=archived&clientName=${nameParam}')
text = text.replace('/ api / quotes', '/api/quotes')

with open('/Users/santiago/Documents/GitHub/integralcomputacion/public/admin/cotizador.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Corrections applied.")
