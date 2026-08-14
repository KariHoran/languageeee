/**
 * Same-origin proxy для переводчиков (Expo Metro / Web).
 * Браузер бьёт в /api/translate → Metro → Google gtx / MyMemory (без CORS).
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

function fetchText(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'languageeee-translate-proxy/1.0',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode || 500,
            body,
            contentType: res.headers['content-type'] || 'application/json',
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('upstream timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseGtx(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
  return data[0]
    .map((item) => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
    .join('')
    .trim();
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true если запрос обработан
 */
async function handleTranslateProxy(req, res) {
  const url = req.url || '';
  if (!url.startsWith('/api/translate')) return false;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  try {
    const parsed = new URL(url, 'http://localhost');
    const q = (parsed.searchParams.get('q') || '').trim();
    const sl = (parsed.searchParams.get('sl') || 'auto').trim();
    const tl = (parsed.searchParams.get('tl') || 'ru').trim();
    const provider = (parsed.searchParams.get('provider') || 'gtx').trim();

    if (!q) {
      sendJson(res, 400, { error: 'Missing q' });
      return true;
    }
    if (q.length > 4500) {
      sendJson(res, 400, { error: 'Text too long' });
      return true;
    }

    let translation = '';
    let used = provider;

    if (provider === 'mymemory') {
      const mmUrl =
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}` +
        `&langpair=${encodeURIComponent(`${sl}|${tl}`)}`;
      const upstream = await fetchText(mmUrl);
      if (upstream.status >= 400) {
        sendJson(res, 502, { error: `MyMemory HTTP ${upstream.status}` });
        return true;
      }
      const data = JSON.parse(upstream.body);
      translation = String(data?.responseData?.translatedText || '').trim();
      if (/^\s*MYMEMORY WARNING/i.test(translation)) {
        sendJson(res, 429, { error: translation });
        return true;
      }
      used = 'mymemory';
    } else {
      const gtxUrl =
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}` +
        `&dt=t&q=${encodeURIComponent(q)}`;
      const upstream = await fetchText(gtxUrl);
      if (upstream.status >= 400) {
        // fallback MyMemory
        const mmUrl =
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}` +
          `&langpair=${encodeURIComponent(`${sl}|${tl}`)}`;
        const mm = await fetchText(mmUrl);
        if (mm.status < 400) {
          const data = JSON.parse(mm.body);
          translation = String(data?.responseData?.translatedText || '').trim();
          used = 'mymemory';
        }
        if (!translation) {
          sendJson(res, 502, { error: `Upstream HTTP ${upstream.status}` });
          return true;
        }
      } else {
        translation = parseGtx(JSON.parse(upstream.body));
        used = 'gtx';
      }
    }

    if (!translation) {
      sendJson(res, 502, { error: 'Empty translation' });
      return true;
    }

    sendJson(res, 200, { translation, provider: used });
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Proxy error',
    });
  }
  return true;
}

module.exports = { handleTranslateProxy };
