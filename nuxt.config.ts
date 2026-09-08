export default defineNuxtConfig({
  compatibilityDate: '2026-09-08',
  devtools: { enabled: false },
  runtimeConfig: { n8nWebhookUrl: '', n8nWebhookSecret: '', n8nTimeoutMs: 120000 },
  app: { head: { title: 'Agent workshop', meta: [{ name: 'description', content: 'Turn an idea into a reviewed plan with a small agent team.' }] } }
})
