// ==================== 步骤B: 📜 获取秘籍目录（宽松匹配） ====================
async function getAnnouncementList(stockId, reportType, years) {
  addLog(`${t('log-get-announcements')}: ${stockId}, ${reportTypeNames[reportType] || reportType}`, 'info');
  const url = `https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_Bulletin/stockid/${stockId}/page_type/${reportType}.phtml`;
  const html = await fetchViaProxy(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const results = [];

  // 调试：输出页面中所有链接数量
  const allLinks = doc.querySelectorAll('a[href]');
  addLog(`[debug] ${t('log-debug-links')} ${allLinks.length} ${t('log-debug-links-suffix')}`, 'debug');

  // 获取匹配关键词
  const keywords = typeKeywords[reportType] || [];

  // 严格匹配：使用完整类型名 + 年份
  const datelist = doc.querySelector('div.datelist');
  let searchLinks = datelist ? datelist.querySelectorAll('a') : allLinks;

  if (!datelist) {
    addLog(`⚠️ no div.datelist found`, 'warn');
  }

  for (const a of searchLinks) {
    const text = a.textContent.trim();
    const href = a.getAttribute('href');
    if (!href) continue;

    for (const year of years) {
      // 检查是否匹配任一关键词和年份
      const matchesType = keywords.some(kw => text.includes(kw));
      const matchesYear = text.includes(String(year));

      if (matchesType && matchesYear) {
        const fullUrl = href.startsWith('http') ? href : `https://vip.stock.finance.sina.com.cn/${href}`;
        // 避免重复
        if (!results.some(r => r.url === fullUrl)) {
          results.push({ title: text, url: fullUrl, year });
          addLog(`${t('log-found-report')}: ${text}`, 'success');
        }
      }
    }
  }

  // 宽松匹配：如果严格匹配没找到，只要包含"报告"和年份
  if (results.length === 0) {
    addLog(t('log-loose-search'), 'warn');
    for (const a of allLinks) {
      const text = a.textContent.trim();
      const href = a.getAttribute('href');
      if (!href) continue;

      for (const year of years) {
        if (text.includes('报告') && text.includes(String(year))) {
          var excludeKeywords = ['社会责任', '内部控制', '审计报告', '评估报告', '鉴证报告'];
          if (excludeKeywords.some(function(kw) { return text.includes(kw); })) continue;
          const fullUrl = href.startsWith('http') ? href : `https://vip.stock.finance.sina.com.cn/${href}`;
          if (!results.some(r => r.url === fullUrl)) {
            results.push({ title: text, url: fullUrl, year });
            addLog(`${t('log-found-report')}: ${text}`, 'success');
          }
        }
      }
    }
  }

  // 调试：输出所有链接文本（当匹配结果为空时）
  if (results.length === 0) {
    addLog(t('log-debug-no-match'), 'warn');
    const linkTexts = Array.from(allLinks).slice(0, 20).map((a, i) => `${i + 1}. [${a.textContent.trim().substring(0, 50)}]`);
    linkTexts.forEach(el => addLog(`  ${el}`, 'debug'));
  }

  if (results.length === 0) {
    addLog(`${t('log-no-report-found')} (${stockId}, ${reportTypeNames[reportType]})`, 'warn');
  }
  return results;
}
