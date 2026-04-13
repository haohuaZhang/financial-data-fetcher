// ==================== CORS代理请求（文本内容，智能轮换） ====================
/**
 * 构建自定义代理函数
 */
function buildCustomProxyFn(proxyUrl) {
  return (targetUrl) => {
    // 确保代理URL格式正确
    if (proxyUrl.includes('?url=')) {
      // 替换 {url} 占位符或追加到现有参数
      if (proxyUrl.includes('{url}')) {
        return proxyUrl.replace('{url}', encodeURIComponent(targetUrl));
      } else {
        return proxyUrl + encodeURIComponent(targetUrl);
      }
    } else {
      // 简单拼接
      return proxyUrl + encodeURIComponent(targetUrl);
    }
  };
}

/**
 * 获取自定义代理名称
 */
function getCustomProxyName(proxyUrl) {
  try {
    const u = new URL(proxyUrl);
    return u.hostname.replace('www.', '');
  } catch (e) {
    return proxyUrl.substring(0, 30);
  }
}

async function fetchViaProxy(url, retries = 3) {
  // 请求去重：如果同一URL已被请求过，直接使用缓存结果
  if (requestCache.has(url)) {
    addLog(`${t('log-cache-hit')} ${url.substring(0, 60)}...`, 'debug');
    return requestCache.get(url);
  }

  const config = getConfig();
  let proxyFns = [];
  let proxyNames = new Map(); // 存储代理名称映射
  
  // 优先派遣自定义弟子
  if (config.useCustomProxy && config.customProxies && config.customProxies.length > 0) {
    for (const proxyUrl of config.customProxies) {
      const fn = buildCustomProxyFn(proxyUrl);
      proxyFns.push(fn);
      proxyNames.set(fn, getCustomProxyName(proxyUrl));
    }
    addLog(`${t('log-proxy-dispatch')} ${proxyFns.length} ${t('log-proxy-custom')}`, 'info');
  }
  
  // 添加内置代理作为备用
  const builtInProxies = getAvailableProxies('text');
  for (const fn of builtInProxies) {
    proxyFns.push(fn);
    proxyNames.set(fn, getProxyName(fn));
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    // 指数退避延迟
    const backoffDelay = Math.pow(2, attempt - 1) * 1000; // 1秒, 2秒, 4秒
    if (attempt > 1) {
      addLog(`${t('log-proxy-retry')} ${attempt} ${t('log-proxy-retry-suffix')} ${backoffDelay/1000} ${t('log-proxy-retry-suffix2')}`, 'warn');
      // 显示倒计时
      for (let i = backoffDelay/1000; i > 0; i--) {
        setProgress(`${t('log-proxy-countdown')}: ${i}${t('log-proxy-seconds')}`, attempt - 1, retries);
        await sleep(1000);
      }
    }
    
    for (const proxyFn of proxyFns) {
      if (shouldStop) throw new Error('用户停止');
      
      try {
        const proxyUrl = proxyFn(url);
        const proxyName = proxyNames.get(proxyFn) || 'Unknown';
        
        // 调试信息：显示当前使用的代理和请求URL
        addLog(`${t('log-proxy-dispatch')}: ${proxyName}`, 'debug');
        addLog(`[request] URL: ${proxyUrl.substring(0, 100)}...`, 'debug');
        
        const startTime = Date.now();
        const resp = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(30000),
          headers: { 'Accept': 'text/html,application/json,*/*' }
        });
        const elapsed = Date.now() - startTime;
        
        // 调试信息：显示响应状态码
        addLog(`[响应] 状态码: ${resp.status}, 耗时: ${elapsed}ms`, 'debug');
        
        if (!resp.ok) {
          const errorMsg = `HTTP ${resp.status} ${resp.statusText}`;
          addLog(`❌ [失败] ${proxyName}: ${errorMsg}`, 'warn');
          markProxyFailed(proxyFn, errorMsg);
          throw new Error(errorMsg);
        }

        let text;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          // JSON响应
          const json = await resp.json();
          text = json.contents || JSON.stringify(json);
        } else {
          // 先获取arrayBuffer（用于可能的GBK解码）
          const buffer = await resp.arrayBuffer();
          // 默认用UTF-8解码
          text = new TextDecoder('utf-8').decode(buffer);
          // 检测是否需要GBK解码（新浪财经等中文网站使用GBK编码）
          const hasGarbled = text.includes('\ufffd\ufffd') || text.includes('\ufffd');
          const isGbkPage = text.includes('charset=gb') || text.includes('charset=GB');
          if (hasGarbled || isGbkPage) {
            try {
              const gbkText = new TextDecoder('gbk').decode(buffer);
              // 验证GBK解码是否更合理（包含更多中文字符）
              const chineseCount = (str) => (str.match(/[\u4e00-\u9fff]/g) || []).length;
              if (chineseCount(gbkText) > chineseCount(text) + 5) {
                text = gbkText;
                addLog(`${t('log-gbk-detected')}（${t('log-chinese-chars')}: ${chineseCount(text)}）`, 'debug');
              }
            } catch (e) {
              // GBK解码失败，使用原始UTF-8文本
            }
          }
        }

        // 验证内容有效性
        if (!text || text.length < 100) {
          // BUG-A06: 内容过短可能是业务错误（页面无数据），不一定是代理故障
          const errorMsg = `${t('log-content-short')} (${text ? text.length : 0} ${t('log-content-chars')})`;
          addLog(`⚠️ [warn] ${proxyName}: ${errorMsg}`, 'warn');
          throw new Error(errorMsg);
        }

        markProxySuccess(proxyFn);
        
        // 调试信息：显示响应内容前100个字符
        const preview = text.substring(0, 100).replace(/<[^>]*>/g, '').trim();
        addLog(`${t('log-proxy-success')} ${proxyName} ${t('log-proxy-get')} ${text.length} ${t('log-proxy-chars')}`, 'success');
        addLog(`[debug] ${t('log-debug-content')}: ${preview}`, 'debug');

        // 请求去重：缓存成功结果
        requestCache.set(url, text);

        return text;
      } catch (e) {
        const proxyName = proxyNames.get(proxyFn) || 'Unknown';
        // 详细错误信息
        let errorDetail = e.message;
        if (e.name === 'AbortError' || e.name === 'TimeoutError') {
          errorDetail = t('log-timeout');
        } else if (e.message.includes('Failed to fetch')) {
          errorDetail = t('log-network-error');
        }
        addLog(`${t('log-proxy-fail')} ${proxyName}: ${errorDetail}`, 'warn');
        
        // 如果是最后一个代理的最后一次重试，抛出错误
        if (attempt === retries && proxyFn === proxyFns[proxyFns.length - 1]) {
          addLog(`${t('log-proxy-all-fail')} ${retries}`, 'error');
          throw new Error(`${t('log-proxy-all-fail-msg')}: ${errorDetail}`);
        }
      }
    }
  }
  throw new Error(t('log-proxy-all-fail-msg'));
}
