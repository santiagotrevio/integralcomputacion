# CRM Territorial Predictivo para Distribuidores Locales B2B
## Arquitectura y Visión de Producto SaaS

### 🧠 Filosofía del Producto
A diferencia de los CRMs tradicionales (Salesforce, HubSpot, Pipedrive) que son repositorios de datos donde el vendedor "trabaja para el sistema", este SaaS invierte la ecuación: **El sistema trabaja para el vendedor.**
Con una interfaz inspirada en Notion (limpia), Linear (rápida) y Stripe (profesional), el sistema responde en segundos a las preguntas vitales del día a día: *¿A quién llamo hoy? ¿Qué zona visito? ¿Quién está a punto de quedarse sin inventario?*

---

### 🛠 Ecosistema Tecnológico Sugerido (100% Free Tier / Open Source)

Para garantizar un inicio con costo $0 y escalabilidad nativa para múltiples inquilinos (Multi-tenant SaaS):

| Componente | Tecnología | Razón (Por qué es gratis y escalable) |
| :--- | :--- | :--- |
| **Frontend** | **Next.js (React) + Tailwind CSS** | Estándar de la industria SaaS. Componentes aislados, ultrarrápido, y permite interfaces tipo Linear. Hosted gratis en Vercel. |
| **Backend & Base de Datos** | **Supabase (PostgreSQL)** | Es la alternativa Open Source a Firebase. Su capa gratuita te da PostgreSQL (ideal para crecer), base de datos en tiempo real, e incorpora *Row Level Security* (vital para separar los datos de la Empresa A y la Empresa B en un SaaS). |
| **Autenticación** | **Supabase Auth** | Incluye login con email, Google, contraseñas, olvidé mi contraseña sin escribir backend. Gratis hasta 50,000 usuarios activos mensuales. |
| **Mapas & Geovistas** | **Leaflet.js + OpenStreetMap** | 100% gratuito, Open Source. No te pide tarjeta de crédito jamás (a diferencia de Google Maps o Mapbox). Perfecto para pintar Heatmaps y Clusters. |
| **Gráficos / Analítica** | **Chart.js o Recharts** | Ligeras, visualmente muy atractivas y Open Source. |
| **Tareas Automáticas (CRON)** | **GitHub Actions / Vercel Cron** | Gratuitos. Para correr un script a las 8:00 AM todos los días que revise a qué clientes les toca renovar o recomprar. |
| **Correos / Alertas** | **Resend (Free Tier)** | Permite enviar hasta 3,000 correos gratis al mes con una API moderna para enviar alertas al equipo. |

---

### 🔥 Propuestas de Válue Proposition (Diferenciadores en México)

Para que el sistema sea único en el mercado latinoamericano de PYMES, debe tener funcionalidades que ataquen el dolor real de nuestra cultura comercial:

1. **"WhatsApp-First" CRM:**
   En México, el correo se ignora, todo se cierra por WhatsApp. Cada tarjeta debe tener un botón que, al darle clic, no solo te abra WhatsApp Web, sino que **ya tenga pre-redactado un mensaje inteligente** según la etapa: 
   * *"Hola [Nombre], te paso el PDF de la cotización..."*
   * *"Hola [Nombre], vimos esto hace 3 días, ¿qué te pareció?"*
2. **Motor Predictivo Básico (El algoritmo del Resurtido):**
   Si Integral Computación le vende 10 tóners a una notaría, y sabemos que les duran 25 días. Al día 21, la Inteligencia Comercial pone una *Alerta Amarilla de Recompra* para el vendedor empujándolo a que mande un mensaje preventivo. ¡Ventas sin esfuerzo!
3. **El Mapa de Campo (Territorialidad Visual):**
   En ventas B2B locales, los vendedores van a la calle (parques industriales, centros logísticos). El mapa no solo debe mostrar los pines geográficos, sino generar la **"Ruta del Día"**: *"Hoy vas al parque industrial X. Tienes 2 clientes a los que no hemos visto hace 45 días en un radio de 1 km. ¡Pasa a visitarlos!"*

---

### ⚙️ Arquitectura Multi-Tenant (Preparado para SaaS)

Las tablas de Supabase (PostgreSQL) estarán diseñadas para separar "Organizaciones/Tenants". 
* Cada usuario pertenece a una Organización (Ej. `tenant_id: 1` -> Integral Computación, `tenant_id: 2` -> Papelería Proveedora XYZ).
* Las políticas de seguridad de PostgreSQL aseguran matemáticamente que ningún usuario pueda jamás ver las ventas o clientes que pertenecen a otro distribuidor.

### 🚀 MVP: Roadmap de Ejecución Rápida

1. **Fase 1 (Prueba de Concepto - Semana 1 y 2)**: 
   Construir la pantalla principal y el Kanban con Supabase/Next.js adaptado aIntegral Computación como el Cliente Cero.
2. **Fase 2 (El Motor Geoespacial - Semana 3)**:
   Integrar Leaflet.js para que todo cliente dado de alta se geolocalice y empiece a "calentar" las métricas del mapa.
3. **Fase 3 (Predicción y Empaque SaaS - Semana 4)**:
   Programar el Job (tarea automática) nocturno que calcula los días de inactividad de cada carta del pipeline y avisa pre-ventas y recompras.
