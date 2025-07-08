'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const https = require('https');
const path = require('path');
require('dotenv').config();

const port = process.env.SERVER_PORT || 9999;
const isap_server_ip = process.env.CALL_SERVER_IP || "127.0.0.1" ;
const isap_server_port = process.env.CALL_SERVER_PORT || 8888 ;

const app = express();

// ⬇️ Serve welcome.html FIRST on root path "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'welcome.html'));
});

// ⬇️ Serve static files WITHOUT auto-serving index.html
app.use(express.static(path.join(__dirname, 'public'), {
    index: false // Prevent index.html from automatically being served
}));

app.get('/env', (req, res) => {
  res.json({
    PROXY_SERVER_IP: process.env.PROXY_SERVER_IP,
    PROXY_SERVER_PORT: process.env.PROXY_SERVER_PORT
  });
});

// ⬇️ Proxy endpoint
app.use('/proxy', async (request, response, next) => {
    if (typeof request.body !== 'string' || request.body.length === 0) delete request.body;

    const controller = new AbortController();

    request.on('close', () => {
        controller.abort();
    });

    console.log(`${request.url}`)
    
    await fetch(`http://${isap_server_ip}:${isap_server_port}${request.url}`, {
        method: request.method,
        body: request.body,
        signal: controller.signal
    })
    .then(res => {
        response.status(res.status);

        const from = res.headers.get('Pragma');
        if (from != null) {
            response.set('Pragma', from);
        }

        return res.arrayBuffer();
    })
    .then(ab => {
        if (ab.byteLength > 0) {
            response.send(Buffer.from(ab));
        }
        response.end();
    })
    .catch(next);
});

// ⬇️ HTTPS Certificate and Server Start
const key = fs.readFileSync(__dirname + '/cert/www.isapsolution.com.key');
const cert = fs.readFileSync(__dirname + '/cert/www.isapsolution.com.crt');

const server = https.createServer({ key, cert }, app);

server.listen(port, () => {
    console.log(`HTTPS server started on port ${port}`);
});
