
/**
 * Integral Computación Chatbot
 * - Agentic capabilities: Product search, FAQ, Quote generation.
 * - Omni-present: Works on any page.
 */

(function () {
    // Configuration
    const CONFIG = {
        name: "Asistente Integral",
        color: "var(--ic-cyan)", // Default to cyan if var exists
        whatsapp: "523312680092",
        welcomeMsg: "Hola 👋, bienvenido a Integral Computación. Soy tu asesor virtual experto en suministros de impresión. ¿Qué estás buscando hoy?",
        fallbackMsg: "Entendido. Para darte el mejor precio, ¿te gustaría que un asesor humano revise tu solicitud en WhatsApp?",
        soundEnabled: true
    };

    // State
    let isOpen = false;
    let hasGreeted = false;
    let chatHistory = [];

    // --- 1. Styles Injection ---
    const styles = `
        /* Chatbot Container */
        .ic-chatbot-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            font-family: 'Inter', sans-serif; /* Fallback font */
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        /* Trigger Button */
        .ic-chat-trigger {
            width: 60px;
            height: 60px;
            background: #0096d6; /* Fallback Blue */
            background: var(--ic-cyan, #0096d6);
            color: white;
            border-radius: 50%;
            border: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            cursor: pointer;
            font-size: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: relative;
        }

        .ic-chat-trigger:hover {
            transform: scale(1.1);
        }

        .ic-chat-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #ef4444;
            color: white;
            font-size: 11px;
            font-weight: bold;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            animation: ic-bounce 2s infinite;
        }

        /* Chat Window */
        .ic-chat-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 350px;
            height: 500px;
            max-height: 80vh;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s ease;
            transform-origin: bottom right;
        }

        .ic-chat-window.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }

        /* Header */
        .ic-chat-header {
            background: linear-gradient(135deg, #0d47a1, #0096d6); /* Blue gradient */
            color: white;
            padding: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .ic-avatar {
            width: 40px;
            height: 40px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .ic-agent-info h4 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
        }
        
        .ic-agent-info p {
            margin: 0;
            font-size: 12px;
            opacity: 0.9;
        }

        .ic-close-btn {
            margin-left: auto;
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s;
        }
        
        .ic-close-btn:hover { opacity: 1; }

        /* Body (Messages) */
        .ic-chat-body {
            flex: 1;
            padding: 15px;
            background: #f8fafc;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .ic-msg {
            max-width: 85%;
            padding: 12px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.5;
            position: relative;
            animation: ic-fade-in 0.3s ease;
        }

        .ic-msg.bot {
            background: white;
            color: #334155;
            border-radius: 4px 12px 12px 12px;
            align-self: flex-start;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        .ic-msg.user {
            background: #0096d6; /* fallback blue */
            background: var(--ic-cyan, #0096d6);
            color: white;
            border-radius: 12px 4px 12px 12px;
            align-self: flex-end;
        }

        .ic-typing {
            font-size: 12px;
            color: #94a3b8;
            margin-left: 10px;
            display: none;
        }

        /* Footer (Input) */
        .ic-chat-footer {
            padding: 10px;
            background: white;
            border-top: 1px solid #f1f5f9;
            display: flex;
            gap: 8px;
        }

        .ic-chat-input {
            flex: 1;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 10px 15px;
            font-family: inherit;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }

        .ic-chat-input:focus {
            border-color: var(--ic-cyan, #0096d6);
        }

        .ic-send-btn {
            background: var(--ic-cyan, #0096d6);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }

        .ic-send-btn:hover { transform: scale(1.1); }

        /* Product Card in Chat */
        .ic-prod-card {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #f1f5f9;
            padding: 10px;
            border-radius: 8px;
            margin-top: 5px;
        }
        
        .ic-prod-card img {
            width: 50px;
            height: 50px;
            border-radius: 4px;
            object-fit: cover;
            background: white;
        }
        
        .ic-prod-card-info h5 {
            margin: 0 0 4px 0;
            font-size: 13px;
        }
        
        .ic-prod-btn {
            padding: 6px 10px;
            background: var(--ic-magenta, #d81b60);
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            margin-top: 5px;
        }

        /* Animations */
        @keyframes ic-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes ic-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* Mobile */
        @media (max-width: 480px) {
            .ic-chat-window {
                width: calc(100vw - 40px);
                right: 0;
                height: 60vh;
            }
        }
    `;

    // --- 2. Logic ---
    function init() {
        injectStyles();
        createDOM();
        bindEvents();

        // Auto-greet
        setTimeout(() => {
            if (!sessionStorage.getItem('ic_greeted')) {
                document.getElementById('ic-badge').style.display = 'flex';
                // Play sound logic here if needed
            }
        }, 3000);
    }

    function injectStyles() {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
    }

    function createDOM() {
        const container = document.createElement('div');
        container.className = 'ic-chatbot-container';
        container.innerHTML = `
            <div class="ic-chat-window" id="ic-window">
                <div class="ic-chat-header">
                    <div class="ic-avatar">🤖</div>
                    <div class="ic-agent-info">
                        <h4>${CONFIG.name}</h4>
                        <p>Respuesta inmediata</p>
                    </div>
                    <button class="ic-close-btn" id="ic-close">×</button>
                </div>
                <div class="ic-chat-body" id="ic-messages">
                    <div class="ic-typing" id="ic-typing">Escribiendo...</div>
                </div>
                <div class="ic-chat-footer">
                    <input type="text" class="ic-chat-input" id="ic-input" placeholder="Escribe tu duda o producto...">
                    <button class="ic-send-btn" id="ic-send">➤</button>
                </div>
            </div>
            <button class="ic-chat-trigger" id="ic-trigger">
                <span class="ic-chat-badge" id="ic-badge" style="display:none">1</span>
                💬
            </button>
        `;
        document.body.appendChild(container);

        // Add initial message
        addMessage(CONFIG.welcomeMsg, 'bot');
    }

    function bindEvents() {
        const trigger = document.getElementById('ic-trigger');
        const windowEl = document.getElementById('ic-window');
        const closeBtn = document.getElementById('ic-close');
        const sendBtn = document.getElementById('ic-send');
        const input = document.getElementById('ic-input');

        trigger.onclick = () => {
            toggleChat();
            sessionStorage.setItem('ic_greeted', 'true');
            document.getElementById('ic-badge').style.display = 'none';
        };

        closeBtn.onclick = toggleChat;

        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }

    function toggleChat() {
        const windowEl = document.getElementById('ic-window');
        isOpen = !isOpen;
        if (isOpen) {
            windowEl.classList.add('active');
            document.getElementById('ic-input').focus();
        } else {
            windowEl.classList.remove('active');
        }
    }

    function sendMessage() {
        const input = document.getElementById('ic-input');
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';

        // Process Logic
        showTyping(true);
        setTimeout(() => {
            processBotResponse(text);
        }, 600);
    }

    function addMessage(text, sender) {
        const messages = document.getElementById('ic-messages');
        const div = document.createElement('div');
        div.className = `ic-msg ${sender}`;
        div.innerHTML = text; // Allow HTML for links

        const typing = document.getElementById('ic-typing');
        messages.insertBefore(div, typing); // Insert before typing indicator

        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping(show) {
        const typing = document.getElementById('ic-typing');
        typing.style.display = show ? 'block' : 'none';
        const messages = document.getElementById('ic-messages');
        messages.scrollTop = messages.scrollHeight;
    }

    function processBotResponse(text) {
        showTyping(false);
        const lower = text.toLowerCase();

        // 1. Check for Quote Intent
        if (lower.includes('cotiza') || lower.includes('precio') || lower.includes('costo')) {
            addMessage(`Para darte el mejor precio, necesito saber qué producto buscas. ¿Me puedes decir el modelo de tu impresora o el código del cartucho?`, 'bot');
            return;
        }

        // 2. Check for Location/Hours
        if (lower.includes('ubicacion') || lower.includes('donde estan') || lower.includes('direccion')) {
            addMessage(`Estamos en Guadalajara. <a href="https://maps.google.com" target="_blank" style="color:#0096d6;text-decoration:underline;">Ver en Mapa</a>.`, 'bot');
            return;
        }

        // 3. Check for Invoice
        if (lower.includes('factura')) {
            addMessage(`¡Sí facturamos! Envíanos tu constancia fiscal al confirmar tu pedido. Todos nuestros precios incluyen IVA.`, 'bot');
            return;
        }

        // 4. Product Search (The Intelligent Part)
        if (typeof productsDB !== 'undefined') {
            // Tokenize: Remove stop words and split by spaces
            const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'para', 'por', 'con', 'en', 'y', 'o', 'que', 'quiero', 'necesito', 'busco', 'me', 'interesa', 'tienes', 'hay', 'hola', 'buenos', 'dias', 'tardes', 'noches', 'cotizar', 'precio', 'costo', 'cuanto', 'cuesta', 'vale', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'soy', 'esta', 'estoy', 'tengo', 'falla', 'fallando', 'impresora', 'impresion'];

            const tokens = lower.split(/[\s,.;:!?]+/).filter(t => t.length > 1 && !stopWords.includes(t));
            let results = [];

            if (tokens.length > 0) {
                results = productsDB.filter(p => {
                    const pText = (p.name + " " + p.id + " " + (p.description || "")).toLowerCase();
                    // Strict: ALL tokens must be present
                    return tokens.every(token => pText.includes(token));
                });
            }

            if (results.length > 0) {
                // Show top 3 results
                const topResults = results.slice(0, 3);
                let cardsHtml = topResults.map(p => `
                    <div class="ic-prod-card">
                        <img src="${p.image || 'assets/images/logo.svg'}" onerror="this.src='assets/images/logo.svg'" alt="Product">
                        <div class="ic-prod-card-info">
                            <h5>${p.name}</h5>
                            <small>ID: ${p.id}</small> <br>
                            <button class="ic-prod-btn" onclick="window.addToCartFromBot('${p.id}')">Agregar</button>
                        </div>
                    </div>
                `).join('');

                const msg = `¡Encontré ${results.length > 3 ? 'varias' : results.length} opciones! Aquí las mejores:<br>${cardsHtml}`;
                addMessage(msg, 'bot');
                return;
            }
        }

        // 5. Fallback
        addMessage(`No estoy seguro de tener eso en el catálogo automático, pero un humano seguro sabe. <br><br> <a href="https://wa.me/${CONFIG.whatsapp}?text=Hola,%20busco:%20${encodeURIComponent(text)}" target="_blank" class="ic-msg-btn" style="background:#25d366;color:white;padding:5px 10px;text-decoration:none;border-radius:4px;">Preguntar en WhatsApp</a>`, 'bot');
    }

    // Global helper for the button inside chat
    window.addToCartFromBot = function (id) {
        // Check if toggleCart exists (if on catalogo page)
        if (typeof toggleCart === 'function') {
            toggleCart(id);
            addMessage('¡Agregado a tu lista de cotización! 📝', 'bot');
        } else {
            // If on other page, redirect to catalogo with add param
            window.location.href = `catalogo.html?add=${id}`;
        }
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
