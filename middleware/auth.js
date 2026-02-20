
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;


const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token === API_SECRET_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado. Se requiere un token válido.' });
    }
};

module.exports = authMiddleware;
