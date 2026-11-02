import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

function agentDevServerPlugin(): Plugin {
  return {
    name: 'farmershaus-agent-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/chat' && req.method === 'POST') {
          try {
            const { handleAgentChat } = await server.ssrLoadModule('/src/lib/agent/handler.ts')
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            const bodyBuffer = Buffer.concat(chunks)
            const host = req.headers.host || 'localhost:5173'
            const webReq = new Request(`http://${host}/api/chat`, {
              method: 'POST',
              headers: req.headers as Record<string, string>,
              body: bodyBuffer,
            })

            const webRes: Response = await handleAgentChat(webReq)

            res.statusCode = webRes.status
            webRes.headers.forEach((value: string, key: string) => {
              res.setHeader(key, value)
            })

            if (webRes.body) {
              const reader = webRes.body.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(value)
              }
            }
            res.end()
          } catch (err: unknown) {
            console.error('Agent Dev Server Error:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            const message = err instanceof Error ? err.message : 'Internal Agent Error'
            res.end(JSON.stringify({ error: message }))
          }
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), agentDevServerPlugin()],
})
