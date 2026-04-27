// ==================== 财务洞察 ====================
const FINANCE_METRICS = [
  { key: 'revenue', label: '营业收入', keywords: ['营业收入', '营业总收入', '主营业务收入', '营业收入合计'] },
  { key: 'profit', label: '净利润', keywords: ['净利润', '归属于母公司股东的净利润', '利润总额'] },
  { key: 'assets', label: '总资产', keywords: ['总资产', '资产总计', '资产合计'] },
  { key: 'liabilities', label: '负债合计', keywords: ['负债合计', '总负债'] },
  { key: 'cash', label: '经营现金流', keywords: ['经营活动产生的现金流量净额', '经营活动现金流', '经营现金流'] },
];

function formatFinanceNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1e8) return (value / 1e8).toFixed(2) + ' 亿';
  if (abs >= 1e4) return (value / 1e4).toFixed(2) + ' 万';
  return value.toFixed(2);
}

function parseNumericCells(row) {
  return row.slice(1).map(cell => {
    if (cell === '' || cell === null || cell === undefined) return null;
    const num = parseFloat(String(cell).replace(/[,，\s]/g, '').replace(/%$/, ''));
    return Number.isFinite(num) ? num : null;
  }).filter(v => v !== null);
}

function findMetricSnapshot(allData, metric) {
  let found = null;
  for (const [sheetName, sheetData] of Object.entries(allData || {})) {
    for (const [tableName, tableRows] of Object.entries(sheetData || {})) {
      if (!Array.isArray(tableRows)) continue;
      for (const row of tableRows) {
        if (!Array.isArray(row) || row.length === 0) continue;
        const head = String(row[0] || '');
        if (!metric.keywords.some(keyword => head.includes(keyword))) continue;
        const numbers = parseNumericCells(row);
        if (numbers.length === 0) continue;
        const current = numbers[numbers.length - 1];
        const previous = numbers.length > 1 ? numbers[numbers.length - 2] : null;
        const change = previous === null ? null : current - previous;
        const rate = previous === null || previous === 0 ? null : (change / Math.abs(previous)) * 100;
        found = { sheetName, tableName, label: head, current, previous, change, rate };
      }
    }
  }
  return found;
}

function collectYearValues() {
  const years = new Set();
  for (const file of collectedFiles) {
    if (file._year !== undefined && file._year !== null && file._year !== '') years.add(String(file._year));
    if (Array.isArray(file._years)) {
      file._years.forEach(y => {
        if (y !== undefined && y !== null && y !== '') years.add(String(y));
      });
    }
  }
  return years;
}

function buildFinanceSummary() {
  const allData = window.__latestExcelData || {};
  const metrics = FINANCE_METRICS.map(metric => ({ ...metric, snapshot: findMetricSnapshot(allData, metric) }));
  return {
    fileCount: collectedFiles.length,
    excelCount: collectedFiles.filter(f => f.type === 'excel').length,
    pdfCount: collectedFiles.filter(f => f.type === 'pdf').length,
    pdfLinkCount: collectedFiles.filter(f => f.type === 'pdf-link').length,
    companyCount: new Set(collectedFiles.map(f => f._company).filter(Boolean)).size,
    yearCount: collectYearValues().size,
    metrics,
  };
}

// 安全的翻译函数，避免全局 t 被覆盖
function ft(key, fallback) { try { return getThemeText(key) || fallback || key; } catch(e) { return fallback || key; } }

function buildFinanceAlerts(summary) {
  if (summary.fileCount === 0) return [{ level: 'success', text: ft('finance-no-data', '暂无数据，开始采集后将自动生成财务洞察') }];
  const alerts = [];
  for (const metric of summary.metrics) {
    const s = metric.snapshot;
    if (!s) continue;
    if (s.rate !== null && Math.abs(s.rate) >= 20) alerts.push({ level: s.rate > 0 ? 'success' : 'danger', text: `${metric.label} 波动 ${s.rate > 0 ? '+' : ''}${s.rate.toFixed(2)}%` });
    if (metric.key === 'profit' && s.current < 0) alerts.push({ level: 'danger', text: `${ft('finance-profit-negative', '净利润为负')}：${formatFinanceNumber(s.current)}` });
    if (metric.key === 'assets' && summary.metrics.find(m => m.key === 'liabilities')?.snapshot) {
      const liabilities = summary.metrics.find(m => m.key === 'liabilities').snapshot.current;
      if (Number.isFinite(liabilities) && Number.isFinite(s.current) && liabilities > s.current) alerts.push({ level: 'warn', text: ft('finance-liabilities-warning', '负债合计高于总资产，建议重点复核') });
    }
  }
  if (alerts.length === 0) alerts.push({ level: 'success', text: ft('finance-stable', '暂无明显异常，整体数据稳定') });
  return alerts.slice(0, 8);
}

function renderFinanceMetric(elId, snapshot) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = snapshot ? `${formatFinanceNumber(snapshot.current)}${snapshot.rate === null ? '' : ` (${snapshot.rate > 0 ? '+' : ''}${snapshot.rate.toFixed(1)}%)`}` : '--';
}

function renderFinanceMetricTable(summary) {
  const body = document.getElementById('financeMetricTableBody');
  if (!body) return;
  const rows = summary.metrics.filter(m => m.snapshot);
  if (rows.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="finance-table-empty">' + ft('finance-no-data-short', '暂无数据') + '</td></tr>';
    return;
  }
  body.innerHTML = rows.map(metric => {
    const s = metric.snapshot;
    const changeClass = s.change === null ? '' : (s.change > 0 ? 'positive' : s.change < 0 ? 'negative' : 'neutral');
    const rateText = s.rate === null ? '--' : `${s.rate > 0 ? '+' : ''}${s.rate.toFixed(2)}%`;
    const changeText = s.change === null ? '--' : `${s.change > 0 ? '+' : ''}${formatFinanceNumber(s.change)}`;
    return `<tr>
      <td>${escapeHtml(metric.label)}</td>
      <td>${formatFinanceNumber(s.current)}</td>
      <td>${s.previous === null ? '--' : formatFinanceNumber(s.previous)}</td>
      <td class="${changeClass}">${changeText}</td>
      <td class="${changeClass}">${rateText}</td>
      <td>${escapeHtml([s.sheetName, s.tableName].filter(Boolean).join(' / '))}</td>
    </tr>`;
  }).join('');
}

function refreshFinanceInsights() {
  const summary = buildFinanceSummary();
  const alerts = buildFinanceAlerts(summary);
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  setText('fiFileCount', summary.fileCount);
  setText('fiExcelCount', summary.excelCount);
  setText('fiPdfCount', summary.pdfCount);
  setText('fiAlertCount', alerts.filter(a => a.level !== 'success').length);
  setText('fiCompanyCount', summary.companyCount);
  setText('fiYearCount', summary.yearCount);
  setText('coFiles', summary.fileCount);
  setText('coSelected', collectedFiles.filter(f => f._selected).length);
  setText('coPdfLinks', summary.pdfLinkCount);
  setText('coFailed', failedTasks.length);
  renderFinanceMetric('fiRevenue', summary.metrics.find(m => m.key === 'revenue')?.snapshot || null);
  renderFinanceMetric('fiProfit', summary.metrics.find(m => m.key === 'profit')?.snapshot || null);
  renderFinanceMetric('fiAssets', summary.metrics.find(m => m.key === 'assets')?.snapshot || null);
  renderFinanceMetric('fiLiabilities', summary.metrics.find(m => m.key === 'liabilities')?.snapshot || null);
  renderFinanceMetricTable(summary);
  const box = document.getElementById('financeAlerts');
  if (!box) return;
  box.innerHTML = alerts.map(alert => `<div class="finance-alert ${alert.level}">${escapeHtml(alert.text)}</div>`).join('');
}

function exportFinanceSummary() {
  const summary = buildFinanceSummary();
  const lines = [];
  lines.push('# 财务洞察摘要');
  lines.push('');
  lines.push(`- 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`- 文件总数：${summary.fileCount}`);
  lines.push(`- 公司数：${summary.companyCount}`);
  lines.push(`- 年份数：${summary.yearCount}`);
  lines.push(`- Excel：${summary.excelCount}`);
  lines.push(`- PDF：${summary.pdfCount}`);
  lines.push(`- PDF链接：${summary.pdfLinkCount}`);
  lines.push('');
  lines.push('## 关键指标');
  for (const metric of summary.metrics) {
    const s = metric.snapshot;
    if (!s) { lines.push(`- ${metric.label}：未识别到数据`); continue; }
    const changeText = s.rate === null ? '' : `，环比/同比 ${s.rate > 0 ? '+' : ''}${s.rate.toFixed(2)}%`;
    lines.push(`- ${metric.label}：${formatFinanceNumber(s.current)}${changeText}`);
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `财务洞察摘要_${new Date().toISOString().slice(0, 10)}.md`);
}

window.refreshFinanceInsights = refreshFinanceInsights;
window.exportFinanceSummary = exportFinanceSummary;
setTimeout(refreshFinanceInsights, 0);
