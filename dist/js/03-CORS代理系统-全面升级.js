// ==================== CORS代理系统（全面升级） ====================

// 文本内容代理（用于HTML页面获取）
// 按 2026-04-27 实测结果排序：可用性 + 速度 + 稳定性
const textProxies = [
  // ⭐⭐⭐ CodeTabs - 完全可用，速度稳定(~2s)，支持GET
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // ⭐⭐ cors.lol - 可用但有限流(429)，限流后需等待
  url => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
  // ⭐⭐ AllOrigins(JSON) - 不稳定，有时超时(~7-15s)，成功时返回JSON
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  // ⭐ AllOrigins(Raw) - 不稳定，成功时直接返回原文
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // ⭐ CorsProxy.io - 被Cloudflare间歇性封禁(403)，偶尔可用
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  // ⭐ X2U - 印度代理，有时404，恢复后可用
  url => `https://cors.x2u.in/${url.replace(/^https?:\/\//, '')}`,
  // ⭐ KillCors - 2026年3月重新上线，连接不稳定
  url => `https://proxy.killcors.com/?url=${encodeURIComponent(url)}`,
];

// 二进制内容代理（用于玉简获取）
const binaryProxies = [
  // ⭐⭐⭐ CodeTabs - 完全可用，支持大文件(625KB)
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // ⭐⭐ cors.lol - 可用但有限流
  url => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
  // ⭐ AllOrigins(Raw) - 不稳定，成功时直接返回二进制
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // ⭐ CorsProxy.io - 间歇性可用
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  // ⭐ X2U - 印度代理，恢复后可用
  url => `https://cors.x2u.in/${url.replace(/^https?:\/\//, '')}`,
  // ⭐ KillCors - 连接不稳定
  url => `https://proxy.killcors.com/?url=${encodeURIComponent(url)}`,
];

// 代理健康状态追踪
// { proxyFn, name, successCount, failCount, consecutiveFails, lastFailTime, cooldownUntil }
const proxyHealth = new Map();

/**
 * 获取代理的简短名称（用于日志和状态面板显示）
 */
function getProxyName(proxyFn) {
  const url = proxyFn('https://example.com');
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    let proxyKey = '';
    if (host.includes('codetabs')) proxyKey = 'codetabs';
    else if (host.includes('cors.lol')) proxyKey = 'cors-lol';
    else if (host.includes('allorigins') && url.includes('/get?')) proxyKey = 'allorigins-json';
    else if (host.includes('allorigins') && url.includes('/raw?')) proxyKey = 'allorigins-raw';
    else if (host.includes('corsproxy.io')) proxyKey = 'corsproxy-io';
    else if (host.includes('x2u')) proxyKey = 'x2u';
    else if (host.includes('killcors')) proxyKey = 'killcors';
    if (proxyKey) return getThemeProxyName(proxyKey);
    return host;
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * 初始化代理健康状态
 */
function initProxyHealth() {
  proxyHealth.clear();
  for (const fn of textProxies) {
    proxyHealth.set(fn, {
      proxyFn: fn,
      name: getProxyName(fn),
      successCount: 0,
      failCount: 0,
      consecutiveFails: 0,
      lastFailTime: 0,
      cooldownUntil: 0,
      type: 'text'
    });
  }
  for (const fn of binaryProxies) {
    // 避免重复注册同一个函数引用
    if (!proxyHealth.has(fn)) {
      proxyHealth.set(fn, {
        proxyFn: fn,
        name: getProxyName(fn),
        successCount: 0,
        failCount: 0,
        consecutiveFails: 0,
        lastFailTime: 0,
        cooldownUntil: 0,
        type: 'binary'
      });
    }
  }
  renderProxyStatus();
}

/**
 * 标记代理成功
 */
function markProxySuccess(proxyFn) {
  const h = proxyHealth.get(proxyFn);
  if (h) {
    h.successCount++;
    h.consecutiveFails = 0;
    renderProxyStatus();
  }
}

/**
 * 标记代理失败
 */
function markProxyFailed(proxyFn, reason) {
  const h = proxyHealth.get(proxyFn);
  if (h) {
    h.failCount++;
    h.consecutiveFails++;
    h.lastFailTime = Date.now();
    // 连续失败3次，冷却60秒
    if (h.consecutiveFails >= 3) {
      h.cooldownUntil = Date.now() + 60000;
      addLog(`${t('log-proxy-cooldown')} ${h.name} ${t('log-proxy-cooldown-msg')}`, 'warn');
    }
    renderProxyStatus();
  }
}

/**
 * 获取可用代理列表（排除冷却中的）
 */
function getAvailableProxies(type) {
  const now = Date.now();
  const sourceList = type === 'binary' ? binaryProxies : textProxies;
  return sourceList.filter(fn => {
    const h = proxyHealth.get(fn);
    if (!h) return true;
    // 检查冷却是否已过期
    if (h.cooldownUntil > now) return false;
    return true;
  });
}

/**
 * Fisher-Yates 随机打乱数组
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 渲染弟子状态面板
 */
function renderProxyStatus() {
  const container = document.getElementById('proxyStatusList');
  if (!container) return;

  let html = '';
  const now = Date.now();

  // 只显示文本代理（主要使用的）
  for (const [idx, fn] of textProxies.entries()) {
    const h = proxyHealth.get(fn);
    if (!h) continue;

    let dotClass = 'idle';
    let statusText = t('proxy-idle');

    if (h.cooldownUntil > now) {
      dotClass = 'cooldown';
      const remaining = Math.ceil((h.cooldownUntil - now) / 1000);
      statusText = `${t('proxy-cooldown-text')} (${remaining}s)`;
    } else if (h.consecutiveFails >= 3) {
      dotClass = 'fail';
      statusText = t('proxy-bad-state');
    } else if (h.successCount > 0 && h.failCount === 0) {
      dotClass = 'ok';
      statusText = t('proxy-good-state');
    } else if (h.failCount > h.successCount) {
      dotClass = 'fail';
      statusText = t('proxy-unstable');
    } else if (h.successCount > 0) {
      dotClass = 'ok';
      statusText = t('proxy-good-state');
    }

    const displayName = escapeHtml(getProxyName(fn));
    html += `
      <div class="proxy-status-item">
        <span class="proxy-order">${idx + 1}</span>
        <span class="proxy-dot ${dotClass}"></span>
        <span class="proxy-name" title="${displayName}">${displayName}</span>
        <span class="proxy-stats">${statusText} | ${h.successCount}S/${h.failCount}F</span>
      </div>
    `;
  }

  container.innerHTML = html;
}
