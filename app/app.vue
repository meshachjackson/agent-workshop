<script setup lang="ts">
import { roles, type RunResult } from '#shared/contract'
const idea = ref('')
const pending = ref(false)
const error = ref('')
const result = ref<RunResult | null>(null)
const labels = { architect: 'Architect', productManager: 'Product manager', developer: 'Developer', qa: 'QA reviewer' }
async function run() {
  if (pending.value) return
  error.value = ''; result.value = null
  if (!idea.value.trim() || idea.value.trim().length > 5000) { error.value = 'Enter an idea between 1 and 5,000 characters.'; return }
  pending.value = true
  try { result.value = await $fetch<RunResult>('/api/run', { method: 'POST', body: { idea: idea.value.trim() }, retry: 0 }) }
  catch (e: unknown) { error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not reach the server. Please check your connection.' }
  finally { pending.value = false }
}
</script>

<template>
  <main>
    <header><span class="eyebrow">THE AGENT WORKSHOP · PROOF OF CONCEPT</span><h1>One idea.<br>A few useful perspectives.</h1><p>A small team will plan, challenge, and refine your idea into a practical next step.</p></header>
    <form @submit.prevent="run" :aria-busy="pending">
      <label for="idea">What should the team work on?</label>
      <textarea id="idea" v-model="idea" maxlength="5000" rows="6" required :disabled="pending" placeholder="For example: Plan a simple app that helps a book club choose its next read." aria-describedby="idea-help" />
      <div class="form-footer"><small id="idea-help">{{ idea.length.toLocaleString() }} / 5,000 characters</small><button :disabled="pending || !idea.trim()">{{ pending ? 'Team is working…' : 'Run agent team →' }}</button></div>
    </form>
    <p v-if="pending" role="status" class="notice">Working through architecture, product, development, and QA. Results will appear together when the workflow finishes.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <section v-if="result" aria-label="Agent results" aria-live="polite">
      <article class="final"><span class="eyebrow">COMPLETE · TEAM RECOMMENDATION</span><h2>{{ result.final.summary }}</h2><ul><li v-for="(detail, i) in result.final.details" :key="i">{{ detail }}</li></ul></article>
      <article v-for="(role, index) in roles" :key="role"><span class="eyebrow">0{{ index + 1 }} / {{ labels[role] }}</span><h2>{{ result.agents[role].summary }}</h2><ul><li v-for="(detail, i) in result.agents[role].details" :key="i">{{ detail }}</li></ul></article>
      <small>Run {{ result.runId }}</small>
    </section>
    <footer>Nuxt → n8n → OpenAI <span>One request. Five perspectives. No saved history in this app.</span></footer>
  </main>
</template>

<style>
:root{font-family:Arial,sans-serif;color:#192e2b;background:#f5f4ef;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:860px;margin:0 auto;padding:64px 24px}header{max-width:660px;margin-bottom:36px}.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.7px;color:#46635b}h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(36px,6vw,60px);line-height:1.08;letter-spacing:-2px;margin:20px 0}p,li{line-height:1.65}header p{color:#52615c;font-size:17px}form,article{padding:26px;background:#fff;border:1px solid #d7ddd5;border-radius:12px}label{display:block;font-weight:700;margin-bottom:14px}textarea{width:100%;resize:vertical;min-height:150px;border:1px solid #bbc8bf;border-radius:7px;padding:16px;font:inherit;line-height:1.5;background:#fcfcf9;color:inherit}textarea:focus,button:focus-visible{outline:3px solid #85b79f;outline-offset:3px}.form-footer{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:16px}small{color:#596b62;font-size:12px}button{background:#204f3d;border:0;border-radius:7px;color:white;padding:14px 20px;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:default}.notice,.error{padding:18px;border-radius:8px}.notice{background:#e2ede6}.error{background:#fbe7e2;color:#7e2a1e}section{margin-top:30px}article{margin-bottom:16px;overflow-wrap:anywhere}article.final{background:#e6eee6;border-color:#bdcdbc}h2{font-size:20px;font-weight:500;line-height:1.5;white-space:pre-wrap}li{white-space:pre-wrap;margin-bottom:8px}ul{padding-left:20px}footer{margin-top:40px;border-top:1px solid #d4dbd3;padding-top:18px;font-size:12px;color:#5a6d62}footer span{display:block;margin-top:8px}@media(max-width:500px){main{padding:36px 16px}form,article{padding:20px}.form-footer{align-items:stretch;flex-direction:column}}
</style>
