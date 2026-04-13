// ==================== CORS代理请求（二进制内容，用于PDF） ====================
async function fetchBinaryViaProxy(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let proxies = getAvailableProxies('binary');
    proxies = shuffleArray(proxies);

    for (const proxyFn of proxies) {
      try {
        const proxyUrl = proxyFn(url);
        const proxyName = getProxyName(proxyFn);
        addLog(`${t('log-binary-proxy')} ${proxyName} ${t('log-binary-proxy-request')}: ${url.substring(0, 60)}...`, 'debug');
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(60000) });
        if (!resp.ok) {
          markProxyFailed(proxyFn, `HTTP ${resp.status}`);
          throw new Error(`HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        if (blob.size > 1000) {
          markProxySuccess(proxyFn);
          return blob;
        } else {
          markProxyFailed(proxyFn, `内容过小(${blob.size}B)`);
          throw new Error(`返回内容过小 (${blob.size} bytes)`);
        }
      } catch (e) {
        const proxyName = getProxyName(proxyFn);
        addLog(`${t('log-proxy-fail')} ${proxyName} ${t('log-binary-proxy-fail')}: ${e.message}`, 'warn');
        if (attempt === retries && proxyFn === proxies[proxies.length - 1]) {
          throw e;
        }
      }
    }
    await sleep(2000);
  }
  throw new Error(t('log-binary-all-fail'));
}
