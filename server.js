
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Importar Routers y Middleware
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

// Configuración Global
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Rutas de API
app.use('/api', publicRoutes);
app.use('/api', adminRoutes);

// Servir archivos estáticos
app.use(express.static('public'));
app.use(express.static(__dirname)); // Raíz (index.html, catalogo.html, etc.)

// Lógica de búsqueda de assets con fallback
app.use('/assets', (req, res, next) => {
    const cleanUrl = req.url.split('?')[0];
    const decodedUrl = decodeURIComponent(cleanUrl);

    // 1. Intentar la ruta exacta
    const exactPath = path.join(__dirname, 'assets', decodedUrl);
    if (fs.existsSync(exactPath) && fs.lstatSync(exactPath).isFile()) {
        return res.sendFile(exactPath);
    }

    // 2. Fallback: buscar por nombre de archivo en carpetas conocidas
    const fileName = path.basename(decodedUrl);
    const searchFolders = [
        path.join(__dirname, 'assets/images/products/toner'),
        path.join(__dirname, 'assets/images/brands'),
        path.join(__dirname, 'assets/images'),
        path.join(__dirname, 'assets')
    ];
    for (let folder of searchFolders) {
        const fullPath = path.join(folder, fileName);
        if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
            return res.sendFile(fullPath);
        }
    }
    next();
});

// Servir assets directamente para rutas que no caen en el fallback
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor refactorizado listo en puerto ${PORT}`));
