// Archivo de Configuración Global de la Aplicación
// Aquí se definen variables y constantes que pueden ser accedidas por cualquier módulo.

const AppConfig = {
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
