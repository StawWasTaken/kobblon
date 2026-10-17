/* GitHub Pages, near enough: a real file or the 404 document. */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ROOT = process.argv[2] ?? 'dist'
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' }

createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0])
  const tries = [join(ROOT, path), join(ROOT, path, 'index.html')]
  for (const file of tries) {
    try {
      if ((await stat(file)).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
        return res.end(await readFile(file))
      }
    } catch { /* next */ }
  }
  res.writeHead(404, { 'content-type': 'text/html' })
  res.end(await readFile(join(ROOT, '404.html')))
}).listen(5355, () => console.log('up'))
