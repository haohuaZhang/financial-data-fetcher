// ==================== 测试自定义代理 ====================
function createTimeoutFetchOptions(timeoutMs, extraOptions = {}) {
  if (typeof AbortController === 'undefined') {
    return { options: extraOptions, clear() {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    options: { ...extraOptions, signal: controller.signal },
    clear() {
      clearTimeout(timer);
    }
  };
}

async function testCustomProxies() {
  const btn = document.getElementById('btnTestProxies');
  const resultEl = document.getElementById('proxyTestResult');
  const proxyText = document.getElementById('customProxies').value.trim();

  if (!proxyText) {
    resultEl.innerHTML = '<span style="color:var(--warning);">' + t('log-no-proxy-input') + '</span>';
    return;
  }

  const proxyUrls = proxyText.split('\n').map(s => s.trim()).filter(Boolean);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> ' + t('log-testing-suffix');
  resultEl.innerHTML = '';

  const testUrl = 'https://httpbin.org/get';
  let results = [];

  for (const proxyUrl of proxyUrls) {
    const fn = buildCustomProxyFn(proxyUrl);
    const name = getCustomProxyName(proxyUrl);
    resultEl.innerHTML += `<div style="margin-bottom:6px;">${t('log-testing-suffix')} ${escapeHtml(name)}... <span class="spinner" style="width:12px;height:12px;border-width:1.5px;"></span></div>`;

    try {
      const fullUrl = fn(testUrl);
      const startTime = Date.now();
      const timeout = createTimeoutFetchOptions(15000);
      let resp;
      try {
        resp = await fetch(fullUrl, timeout.options);
      } finally {
        timeout.clear();
      }
      const elapsed = Date.now() - startTime;

      if (resp.ok) {
        const text = await resp.text();
        if (text.length > 50) {
          results.push({ name, status: 'ok', time: elapsed });
        } else {
          results.push({ name, status: 'warn', time: elapsed, msg: t('log-content-short') });
        }
      } else {
        results.push({ name, status: 'fail', time: elapsed, msg: `HTTP ${resp.status}` });
      }
    } catch (e) {
      results.push({ name, status: 'fail', time: 0, msg: e.message.substring(0, 50) });
    }
  }

  let html = '';
  for (const r of results) {
    if (r.status === 'ok') {
      html += `<div style="margin-bottom:4px;"><span style="color:var(--success);">&#10003;</span> <strong>${escapeHtml(r.name)}</strong> - ${t('proxy-good-state')} (${r.time}ms)</div>`;
    } else if (r.status === 'warn') {
      html += `<div style="margin-bottom:4px;"><span style="color:var(--warning);">&#9888;</span> <strong>${escapeHtml(r.name)}</strong> - ${escapeHtml(r.msg)} (${r.time}ms)</div>`;
    } else {
      html += `<div style="margin-bottom:4px;"><span style="color:var(--error);">&#10007;</span> <strong>${escapeHtml(r.name)}</strong> - ${escapeHtml(r.msg)}</div>`;
    }
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  html = `<div style="margin-bottom:8px;font-weight:600;">${t('log-test-done')}: ${okCount}/${results.length} ${t('log-test-available')}</div>` + html;
  resultEl.innerHTML = html;
  btn.disabled = false;
  btn.innerHTML = t('btn-test-proxy');
}
