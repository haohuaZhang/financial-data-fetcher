// ==================== CORS代理请求（二进制内容，用于PDF） ====================

async function isValidPdfBlob(blob) {
  if (!blob || blob.size < 1000) return false;
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 8) return false;

    const toAscii = (slice) => {
      let out = '';
      for (let i = 0; i < slice.length; i++) out += String.fromCharCode(slice[i]);
      return out;
    };

    const header = toAscii(bytes.slice(0, Math.min(bytes.length, 16)));
    if (!header.includes('%PDF-')) return false;

    const tailBytes = bytes.slice(Math.max(0, bytes.length - 4096));
    const tail = toAscii(tailBytes);
    return tail.includes('%%EOF');
  } catch (e) {
    return false;
  }
}

async function fetchBinaryViaProxy(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let proxies = getAvailableProxies('binary');

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
        if (await isValidPdfBlob(blob)) {
          markProxySuccess(proxyFn);
          return blob;
        }
        markProxyFailed(proxyFn, '非PDF内容');
        throw new Error('返回内容不是有效PDF');
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
