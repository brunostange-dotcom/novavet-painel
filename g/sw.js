'use strict';
/* Service worker do app Novavet (instalável no notebook, tablet e celular).
   - A página do painel usa "rede primeiro": sempre tenta buscar a versão mais nova (o painel é atualizado todo dia);
     se estiver sem internet, abre a última versão guardada.
   - Ícones e manifesto ficam guardados e abrem na hora.
   - Os painéis individuais dos RCAs (/r/...) não passam por aqui. */
const VERSAO = 'novavet-app-v1';
const ESTATICOS = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-64.png'];
const RAIZ = self.registration.scope;   // ex.: https://.../novavet-painel/

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ESTATICOS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.href.startsWith(RAIZ) || url.pathname.includes('/r/')) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        const resp = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 12000))]);
        if (resp && resp.ok) cache.put(RAIZ, resp.clone());
        return resp;
      } catch (err) {
        const guardada = await cache.match(RAIZ);
        if (guardada) return guardada;
        return new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#0e1a21;color:#e8f0f3;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h2>Sem conexão</h2><p>Conecte-se à internet para abrir o painel pela primeira vez.</p></div>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(h => h || fetch(req)));
});
