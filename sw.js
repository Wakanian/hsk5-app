/* ============================================================
   錦囊妙語 HSK5 単語帳・クイズ — Service Worker
   アプリ本体・データ・アイコンをキャッシュし、
   機内モードなど完全オフラインでも動作するようにする。
   ============================================================ */

// バージョンを上げるとキャッシュが更新される（内容を変更したら数字を増やす）
const CACHE_VERSION = 'v5';
const CACHE_NAME = `hsk5-vocab-${CACHE_VERSION}`;

// オフラインで必要な全ファイル（アプリの「殻」+ データ + アイコン）
const APP_SHELL = [
  './',
  './index.html',
  './words.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// インストール時：必要なファイルを全部キャッシュに入れる
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 有効化時：古いバージョンのキャッシュを削除する
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('hsk5-vocab-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// リクエスト時：まずキャッシュを見て、なければネットワークから取得
// （取得できたら次回のためにキャッシュへ保存する）
self.addEventListener('fetch', (event) => {
  // Google Fonts など外部リソースはネットワーク優先・失敗時は無視
  // （フォントが読めなくてもアプリ自体は動く）
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 204 }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // オフラインかつキャッシュにも無い場合、画面遷移リクエストなら
          // index.html を代わりに返す（SPA的なフォールバック）
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
