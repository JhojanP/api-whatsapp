const chromium = require('@sparticuz/chromium');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
 

const express = require('express');
const cors = require('cors'); // <--- 1. Agregar esta línea
const qrcodeTerminal = require('qrcode-terminal'); // Para seguir viéndolo en consola
const QRCode = require('qrcode'); // Para generar la imagen base64
const bodyParser = require('body-parser');

const app = express();
app.use(cors()); 
app.use(bodyParser.json({ limit: '50mb' }));

  
// Variables de estado globales
let ultimoQR = "";
let estaListo = false;

 /*
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});*/

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        args: chromium.args
    }
});



// --- EVENTOS DEL CLIENTE ---

client.on('qr', async (qr) => {
    estaListo = false;
    ultimoQR = await QRCode.toDataURL(qr); // Genera Base64 para la web
    qrcodeTerminal.generate(qr, { small: true }); // Mantiene log en consola
    console.log('Nuevo QR generado. Esperando escaneo...');
});

client.on('ready', () => {
    estaListo = true;
    ultimoQR = "";
    console.log('✅ WhatsApp está conectado y listo!');
});

client.on('disconnected', () => {
    estaListo = false;
    console.log('❌ WhatsApp se desconectó.');
});

// --- ENDPOINTS DE ESTADO Y SESIÓN ---

// Para que tu página web consulte el QR o el estado
app.get('/obtener-qr', (req, res) => {
    res.json({
        logueado: estaListo,
        qrBase64: ultimoQR // Si está listo, esto será ""
    });
});

// Para cerrar la sesión desde tu panel
app.post('/cerrar-sesion', async (req, res) => {
    try {
        await client.logout();
        estaListo = false;
        res.json({ status: 'Sesión cerrada correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al cerrar sesión: ' + err.message });
    }
});

// --- ENDPOINTS DE ENVÍO ---

app.post('/enviar-pdf', async (req, res) => {
    if (!estaListo) return res.status(503).json({ error: 'WhatsApp no está conectado' });

    const { telefono, pdfBase64, nombreArchivo } = req.body;
    try {
        const media = new MessageMedia('application/pdf', pdfBase64, nombreArchivo);
        const chatId = telefono.includes('@c.us') ? telefono : `${telefono}@c.us`;
        await client.sendMessage(chatId, media);
        res.send({ status: 'Enviado con éxito' });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

app.post('/enviar-mensaje', async (req, res) => {
    if (!estaListo) return res.status(503).json({ error: 'WhatsApp no está conectado' });

    const { telefono, mensaje } = req.body;
    try {
        const chatId = telefono.includes('@c.us') ? telefono : `${telefono}@c.us`;
        await client.sendMessage(chatId, mensaje);
        res.send({ status: 'Mensaje enviado con éxito' });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Node.js corriendo en ${PORT}`);
});
