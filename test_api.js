const http = require('http');

http.get('http://localhost:3000/api/conflicts', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Conflicts Count:', json.data.length);
            if (json.data.length > 0) {
                console.log('First Conflict ID:', json.data[0].product_id);
            }
        } catch (e) {
            console.log('Error parsing JSON:', e.message);
            console.log('Raw Data:', data.substring(0, 100));
        }
    });
}).on('error', (err) => {
    console.log('Error:', err.message);
});
