const http = require('http');
const fs = require('fs');
const path = require('path');
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

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('   ⚫ GANTZ WEB // SERVIDOR DE PREVISUALIZACIÓN ⚫');
  console.log('======================================================');
  console.log(`🖥️  PANTALLA ESFERA:    http://localhost:${PORT}/index.html`);
  console.log(`📱 CONTROL REMOTO:     http://localhost:${PORT}/remote.html`);
  console.log('------------------------------------------------------');
  console.log(' Abriendo pestañas en tu navegador predeterminado...');
  console.log(' Presiona CTRL+C para detener el servidor.');
  console.log('======================================================\n');

  // Automatically open both display and remote tabs on startup
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${startCmd} http://localhost:${PORT}/index.html`);
  setTimeout(() => {
    exec(`${startCmd} http://localhost:${PORT}/remote.html`);
  }, 1000);
});
