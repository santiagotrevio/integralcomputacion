const http = require('http');

setTimeout(() => {
    http.get('http://localhost:3000/api/quotes?status=active', {
      headers: {
        'Authorization': 'Bearer asdf'
      }
    }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => console.log('active:', res.statusCode, body[:100]));
    });

}, 100);
