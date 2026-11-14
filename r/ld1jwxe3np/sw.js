'use strict';
/* Service worker do app de CADA RCA (fica em /r/<código>/sw.js e só controla o painel daquele RCA).
   Página: rede primeiro (o painel atualiza todo dia), com a última versão guardada para abrir sem internet.
   Ícones e manifesto ficam guardados (os ícones são os mesmos do painel gerencial, na pasta do site). */
const RAIZ = self.registration.scope;                 // ex.: https://.../novavet-painel/r/abc123/
const PREFIXO = 'novavet-rca:' + RAIZ + ':';
const VERSAO = PREFIXO + 'v1';
const ESTATICOS = ['manifest.webmanifest', '../../icon-192.png', '../../icon-512.png', '../../icon-maskable-512.png', '../../apple-touch-icon.png', '../../favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ESTATICOS.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIXO) && k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    if (!url.href.startsWith(RAIZ)) return;
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
  if (url.href.startsWith(RAIZ) || ESTATICOS.some(f => new URL(f, RAIZ).href === url.href)) e.respondWith(caches.match(req).then(h => h || fetch(req)));
});
