const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ----------------- NATIVE WEBSOCKET RELAY -----------------
const wsClients = new Set();

function broadcastWS(data, senderSocket) {
  const frame = encodeWSFrame(data);
  for (const client of wsClients) {
    if (client.readyState === 1 && client.socket !== senderSocket) {
      try {
        client.socket.write(frame);
      } catch (err) {
        console.error('WS write error:', err);
      }
    }
  }
}

function encodeWSFrame(data) {
  const payload = Buffer.from(data, 'utf8');
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

function handleWSHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

  const client = { socket, readyState: 1 };
  wsClients.add(client);

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f;
      const isMasked = (buffer[1] & 0x80) !== 0;
      let payloadLen = buffer[1] & 0x7f;
      let offset = 2;

      if (opcode === 0x08) {
        socket.end();
        wsClients.delete(client);
        return;
      }
      if (opcode === 0x09) {
        socket.write(Buffer.from([0x8a, 0x00]));
        buffer = buffer.slice(2);
        continue;
      }

      if (payloadLen === 126) {
        if (buffer.length < 4) break;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) break;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLength = isMasked ? 4 : 0;
      if (buffer.length < offset + maskLength + payloadLen) break;

      let mask = null;
      if (isMasked) {
        mask = buffer.slice(offset, offset + 4);
        offset += 4;
      }

      const payload = buffer.slice(offset, offset + payloadLen);
      buffer = buffer.slice(offset + payloadLen);

      if (isMasked && mask) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }

      if (opcode === 0x01) {
        const msgStr = payload.toString('utf8');
        broadcastWS(msgStr, socket);
      }
    }
  });

  socket.on('close', () => {
    client.readyState = 3;
    wsClients.delete(client);
  });
  socket.on('error', () => {
    client.readyState = 3;
    wsClients.delete(client);
  });
}

// ----------------- STATIC HTTP SERVER -----------------
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(ROOT_DIR, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('upgrade', (req, socket) => {
  handleWSHandshake(req, socket);
});

function startServer(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Puerto ${port} en uso, probando automáticamente en ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log('\n======================================================');
    console.log('   ⚫ GANTZ WEB // SERVIDOR DE PREVISUALIZACIÓN ⚫');
    console.log('======================================================');
    console.log(`🖥️  PANTALLA ESFERA:    http://localhost:${port}/index.html`);
    console.log(`📱 CONTROL REMOTO:     http://localhost:${port}/remote.html`);
    console.log('⚡ CANAL WEBSOCKET:    Habilitado en puerto ' + port);
    console.log('------------------------------------------------------');
    console.log(' Abriendo pestañas en tu navegador predeterminado...');
    console.log(' Presiona CTRL+C para detener el servidor.');
    console.log('======================================================\n');

    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} http://localhost:${port}/index.html`);
    setTimeout(() => {
      exec(`${startCmd} http://localhost:${port}/remote.html`);
    }, 1000);
  });
}

startServer(PORT);
