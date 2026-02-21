# Guía de Configuración: Motor Geocoding de Google Maps

Este documento te guiará paso a paso para obtener tu llave (API Key) y habilitar la inteligencia de Google Maps en el buscador de direcciones de tu CRM.

**Nota importante sobre costos:** Google te regala $200 USD de crédito cada mes para uso de mapas. Las consultas de Geocoding (convertir texto a coordenadas) cuestan fracciones de centavo, por lo que, a menos que tengas decenas de miles de búsquedas mensuales en tu módulo operativo, **tu costo siempre será $0 pesos**.

---

### Paso 1: Configurar Proyecto en Google Cloud
1. Abre tu navegador y entra a: [console.cloud.google.com](https://console.cloud.google.com/)
2. Inicia sesión con el correo de Gmail que quieras administrar la plataforma (preferiblemente uno corporativo o el tuyo personal fundador).
3. Acepta los Términos de Servicio si es la primera vez que entras.
4. En la barra superior, a la izquierda buscar un texto que dice `Selecciona un Proyecto` (o el nombre de algún proyecto viejo). Dale clic.
5. En la ventana que aparece, dale arriba a la derecha en **"Proyecto Nuevo"**.
6. Ponle de nombre `Integral CRM` y dale clíck en el botón azul de **"Crear"**.

### Paso 2: Habilitar la Inteligencia "Geocoding API"
1. Espera unos segundos a que se cree tu proyecto. La página se actualizará o te mostrará una notificación de que ya está listo. Selecciónalo para entrar a él.
2. Ve al menú de "Hamburguesa" (las 3 rayitas arriba a la izquierda) y navega a:
   `API y Servicios` -> `Biblioteca`
3. Vas a ver un buscador gigante en medio. Escribe exactamente esto: **Geocoding API** y presiona Enter.
4. Te saldrán varios resultados, dale clic a la tarjeta que tiene el ícono verde de un mapa y dice literalmente "Geocoding API".
5. Dale clic al botón azul gigante que dice **"Habilitar"**.

### Paso 3: Activar Perfil de Facturación (Requisito de Google)
*Si tu cuenta ya tiene una tarjeta en Google de algo previo, google saltará este paso automático.*
1. Al habilitar, puede que te saque una pantalla pidiendo un método de facturación.
2. Sigue los pasos para agregar una tarjeta de crédito o débito a nombre de Integral Computación o tuya.
3. **¿Me van a cobrar?** NO. Google explícitamente avisa que no realizará cargos automáticos de "sorpresa" sin tu permiso si llegas a exceder los $200 USD regalados cada mes. Solo requiere la tarjeta para comprobar que eres un humano real y que no harás millones de peticiones maliciosas (Spambots).

### Paso 4: Obtener tu Llave (API Key)
1. Con la API ya habilitada, vamos de nuevo al menú izquierdo (hamburguesa).
2. Entra a `API y Servicios` -> `Credenciales`.
3. Arriba vas a ver un botón que dice **"+ Crear Credenciales"**. Dale clic.
4. Selecciona la primera opción: **"Clave de API"**.
5. Se abrirá un cuadro emergente diciéndote "API Key Creada" y verás un código larguísimo y raro que empieza con `AIzaSy...`.
6. ¡Esa es tu llave maestra! Usa el ícono de los dos cuadritos a su lado para **copiarla completa**.

### Paso 5: Conectarlo a tu Código
1. En tu computadora (y en el repositorio), abre el archivo que creamos específicamente para llaves y sucursales, en esta ruta:
   `public/assets/js/app-config.js`
2. El archivo se ve algo así. Ubica la línea donde están las comitas simples solas que dice `googleMapsApiKey`:
   ```javascript
   const AppConfig = {
       googleMapsApiKey: '', // <-- AQUÍ
       branches: [ ... ]
   }
   ```
3. Pega tu llave exactamente dentro de las comillas simples, sin borrar las comillas, quedando así:
   `googleMapsApiKey: 'AIzaSyDu838hf...xyz',`
4. Guarda el archivo (`Cmd + S` o `Ctrl + S`).
5. Sube tus cambios a GitHub (`git add .`, `git commit ...`, `git push...`) o simplemente súbelo al servidor cuando lo despliegues.

¡Listo! A partir del mismo instante en que se refresque la página (Cmd + Shift + R), el sistema de "Ubicarlos Automático" tanto de Nuevos Clientes como de Sucursales dejará de usar la red libre, y se anclará directamente a los satélites en tiempo real precisos de Google.

---

**Tip de Seguridad:** Por practicidad ahorita la llave se pega ahí; cuando Integral Computación abra operaciones multicuenta tipo SaaS en varios años, en lugar de pegarla en un Javascript (porque cualquier programador podría inspeccionar código y verla), la pondremos como `Variable de Entorno Base de Datos`, pero para esta fase tuya de Comando 1.0, esta implementación moderna es la estándar del mercado.
