const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { handleTranslateProxy } = require('./scripts/translateProxy');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Expo SDK 53 + Firebase Auth: package exports ломают регистрацию auth
 * («Component auth has not been registered yet»).
 * Держим false; пакеты с exports резолвим вручную ниже.
 */
config.resolver.unstable_enablePackageExports = false;

/** Same-origin /api/translate для Web (обход CORS у Google/MyMemory). */
const previousEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previousEnhance
      ? previousEnhance(middleware, server)
      : middleware;
    return (req, res, next) => {
      Promise.resolve(handleTranslateProxy(req, res))
        .then((handled) => {
          if (!handled) base(req, res, next);
        })
        .catch((err) => {
          console.error('[metro translate proxy]', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy middleware failed' }));
          }
        });
    };
  },
};

function resolveExisting(...candidates) {
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

/**
 * Zustand 5 ESM (`*.mjs`) содержит `import.meta.env` → SyntaxError на web.
 * @pinyin-pro/data и opencc-js публикуют только через exports.
 * @firebase/* — форсируем ESM-резолв.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    const subpath =
      moduleName === 'zustand' ? 'index.js' : `${moduleName.slice('zustand/'.length)}.js`;
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/zustand', subpath),
    };
  }

  if (moduleName.startsWith('@pinyin-pro/data/')) {
    const sub = moduleName.slice('@pinyin-pro/data/'.length);
    const base = path.resolve(
      __dirname,
      'node_modules/@pinyin-pro/data/dist',
      sub
    );
    const filePath = resolveExisting(`${base}.js`, `${base}.mjs`);
    if (filePath) return { type: 'sourceFile', filePath };
  }

  if (moduleName === 'opencc-js' || moduleName.startsWith('opencc-js/')) {
    const root = path.resolve(__dirname, 'node_modules/opencc-js');
    const sub = moduleName === 'opencc-js' ? 'full' : moduleName.slice('opencc-js/'.length);
    const filePath = resolveExisting(
      path.join(root, 'dist/esm', `${sub}.js`),
      path.join(root, 'dist/umd', `${sub}.js`),
      path.join(root, 'dist/esm-lib', `${sub}.js`),
      path.join(root, 'dist/esm-lib/preset', `${sub}.js`)
    );
    if (filePath) return { type: 'sourceFile', filePath };
  }

  if (moduleName.startsWith('@firebase/')) {
    return context.resolveRequest(
      {
        ...context,
        isESMImport: true,
        resolveRequest: undefined,
      },
      moduleName,
      platform
    );
  }

  return context.resolveRequest(
    { ...context, resolveRequest: undefined },
    moduleName,
    platform
  );
};

module.exports = config;
