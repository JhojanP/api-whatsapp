 // =======================
// IMPORTS
// =======================
const chromium = require('@sparticuz/chromium');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

// =======================
// APP
// =======================
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// =======================
// ESTADO GLOBAL
// =======================
let client = null;
let estaListo = false;
let ultimoQR = "";

// =======================
// WHATSAPP INIT
// =======================
async function iniciarWhatsApp() {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            args: chromium.args
        }
    });

    client.on('qr', async (qr) => {
        estaListo = false;
        ultimoQR = await QRCode.toDataURL(qr);
        qrcodeTerminal.generate(qr, { small: true });
        console.log('📱 QR generado. Escanéalo.');
    });

    client.on('ready', () => {
        estaListo = true;
        ultimoQR = "";
        console.log('✅ WhatsApp conectado y listo');
    });

    client.on('disconnected', () => {
        estaListo = false;
        console.log('❌ WhatsApp desconectado');
    });

    await client.initialize();
}

// =======================
// ENDPOINTS
// =======================

// Estado + QR
app.get('/obtener-qr', (req, res) => {
    res.json({
        logueado: estaListo,
        qrBase64: ultimoQR
    });
});

// Cerrar sesión
app.post('/cerrar-sesion', async (req, res) => {
    try {
        if (!client) {
            return res.status(400).json({ error: 'Cliente no inicializado' });
        }

        await client.logout();
        estaListo = false;

        res.json({ status: 'Sesión cerrada correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Enviar mensaje texto
app.post('/enviar-mensaje', async (req, res) => {
    if (!client || !estaListo) {
        return res.status(503).json({ error: 'WhatsApp no está conectado' });
    }

    const { telefono, mensaje } = req.body;

    try {
        const chatId = telefono.includes('@c.us')
            ? telefono
            : `${telefono}@c.us`;

        await client.sendMessage(chatId, mensaje);

        res.json({ status: 'Mensaje enviado con éxito' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Enviar PDF
app.post('/enviar-pdf', async (req, res) => {
    if (!client || !estaListo) {
        return res.status(503).json({ error: 'WhatsApp no está conectado' });
    }

    const { telefono, pdfBase64, nombreArchivo } = req.body;

    try {
        const media = new MessageMedia(
            'application/pdf',
            pdfBase64,
            nombreArchivo
        );

        const chatId = telefono.includes('@c.us')
            ? telefono
            : `${telefono}@c.us`;

        await client.sendMessage(chatId, media);

        res.json({ status: 'PDF enviado con éxito' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// START SERVER
// =======================
(async () => {
    await iniciarWhatsApp();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor Node.js corriendo en ${PORT}`);
    });
})();
