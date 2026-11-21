const CACHE = 'galpao-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    )
})

self.addEventListener('fetch', (event) => {
    const req = event.request
    if (req.method !== 'GET') return

    const url = new URL(req.url)
    if (url.origin !== self.location.origin) return // Supabase e outros sites: não mexe

    // Páginas: tenta a rede (versão nova); sem internet, abre a última guardada
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone()
                        caches.open(CACHE).then((c) => c.put('/index.html', copy))
                    }
                    return res
                })
                .catch(() => caches.match('/index.html')),
        )
        return
    }

    // Arquivos do app (JS, CSS, ícones): usa o guardado e completa com a rede
    event.respondWith(
        caches.match(req).then(
            (hit) =>
                hit ||
                fetch(req).then((res) => {
                    if (res.ok) {
                        const copy = res.clone()
                        caches.open(CACHE).then((c) => c.put(req, copy))
                    }
                    return res
                }),
        ),
    )
})