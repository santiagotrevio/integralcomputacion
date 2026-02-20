const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/quotes?status=active',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer asdf' // Fake token to see if it responds with valid JSON
    }
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data.substring(0, 50));
    });
});
req.end();
