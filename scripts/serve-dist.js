const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.ROMA_PREVIEW_PORT) || 4173;
const host = process.env.ROMA_PREVIEW_HOST || '127.0.0.1';

const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
    '.woff2': 'font/woff2'
};

const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || host}`).pathname);
    const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const resolvedPath = path.resolve(root, requestedPath);
    const safePath = resolvedPath.startsWith(`${root}${path.sep}`) || resolvedPath === path.join(root, 'index.html');
    const assetPath = safePath && fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
        ? resolvedPath
        : path.join(root, 'index.html');

    fs.readFile(assetPath, (error, content) => {
        if (error) {
            response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('No se pudo abrir el build de Roma Finanzas.');
            return;
        }

        response.writeHead(200, {
            'Content-Type': contentTypes[path.extname(assetPath)] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        response.end(content);
    });
});

server.listen(port, host, () => {
    console.log(`Roma Finanzas disponible en http://${host}:${port}`);
});

