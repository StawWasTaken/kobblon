import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/*
 * The server for looking at whole pages on their own.
 *
 * Two reasons it is its own config rather than the dev server. The site's
 * dev server at `/` hands out the deployed bundle that `publish-to-root.mjs`
 * leaves in the repository root, which is how an hour went missing once -
 * a correct change, served correctly, invisible in the screenshot. And a
 * page decides part of its layout from who is signed in, so `@/hooks/useAuth`
 * is aliased to a fixture here: with the real one the preview reaches the
 * network, finds nobody, and shows the one shape of the page that cannot be
 * compared against what Staw sees.
 *
 * Nothing the site ships reads this file.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5347, strictPort: true },
  resolve: {
    alias: [
      {
        find: /^@\/hooks\/useAuth$/,
        replacement: fileURLToPath(new URL('./tools/site/pages-auth-stub.tsx', import.meta.url)),
      },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
})
