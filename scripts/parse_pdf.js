const fs = require('fs');
const pdf = require('pdf-parse');

const filename = '/Users/santiago/Downloads/facturas/Fact 529 PROMOCION CULTURAL DE OCCIDENTE.pdf';
let dataBuffer = fs.readFileSync(filename);

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(err => {
    console.error(err);
});
