// Archivo de Configuración Global de la Aplicación

const AppConfig = {
    // Para Geocodificación Exacta e Inteligente (Google Maps)
    // Instrucciones: Pega tu "API Key" de Google Cloud Console aquí adentro de las comillas.
    googleMapsApiKey: '',

    // Sucursales Propias (Para mostrar en Mapas, Cotizaciones, etc)
    branches: [
        {
            id: 'matriz',
            name: 'Integral Computación (Matriz)',
            description: 'Av. Circunvalación División del Norte 1438, Guadalajara',
            lat: 20.7027581,
            lng: -103.3340538
        }
    ]
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}
