// ==================== 步骤A: 搜索股票代码 ====================
async function searchStockCode(companyName) {
  addLog(`${t('log-search-stock')}: ${companyName}`, 'info');

  // 方法1: JSON API
  try {
    const apiUrl = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(companyName)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8`;
    const text = await fetchViaProxy(apiUrl);
    const json = JSON.parse(text);
    if (json && json.QuotationCodeTable && json.QuotationCodeTable.Data) {
      for (const item of json.QuotationCodeTable.Data) {
        if (item.SecurityTypeName === 'A股' || item.MktNum === '0' || item.MktNum === '1') {
          const code = item.Code;
          if (/^\d{6}$/.test(code)) {
            addLog(`${t('log-found-stock')}: ${code} (${item.Name || companyName})`, 'success');
            return code;
          }
        }
      }
    }
    // 兜底: 取第一个结果
    if (json && json.QuotationCodeTable && json.QuotationCodeTable.Data && json.QuotationCodeTable.Data.length > 0) {
      const code = json.QuotationCodeTable.Data[0].Code;
      addLog(`${t('log-found-stock')}: ${code}`, 'success');
      return code;
    }
  } catch (e) {
    addLog(`${t('log-stock-search-fail')}: ${e.message}`, 'warn');
  }

  // 方法2: HTML解析
  try {
    const searchUrl = `https://so.eastmoney.com/web/s?keyword=${encodeURIComponent(companyName)}`;
    const html = await fetchViaProxy(searchUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a.exstock_t_l');
    for (const link of links) {
      const match = link.textContent.match(/\((\d{6})\)/);
      if (match) {
        addLog(`🎯 log-found-stock-placeholder: ${match[1]}`, 'success');
        return match[1];
      }
    }
    const allLinks = doc.querySelectorAll('a[href*="quote.eastmoney"]');
    for (const link of allLinks) {
      const match = link.href.match(/(\d{6})\.html/);
      if (match) {
        addLog(`🎯 log-found-stock-placeholder: ${match[1]}`, 'success');
        return match[1];
      }
    }
  } catch (e) {
    addLog(`${t('log-stock-search-fail')}: ${e.message}`, 'error');
  }

  throw new Error(`${t('log-stock-not-found')} "${companyName}" ${t('log-stock-code')}`);
}
