// ==================== Excel模板生成 ====================

/* ---------- 数据格式转换 ---------- */
function convertExcelDataToArray() {
  var raw = window.__latestExcelData;
  if (!raw) return [];
  // 如果已经是数组格式，直接返回
  if (Array.isArray(raw)) return raw.filter(function(f) { return f.type === 'excel'; });
  // 对象格式转换
  var result = [];
  for (var sheetKey in raw) {
    if (!raw.hasOwnProperty(sheetKey)) continue;
    var sheetData = raw[sheetKey];
    if (!sheetData || typeof sheetData !== 'object') continue;
    // sheetKey 格式: "公司名_报告类型"
    var name = sheetKey;
    // 合并该sheet下所有表格的行
    var allRows = [];
    for (var tableName in sheetData) {
      if (!sheetData.hasOwnProperty(tableName)) continue;
      var tableRows = sheetData[tableName];
      if (Array.isArray(tableRows)) {
        allRows = allRows.concat(tableRows);
      }
    }
    if (allRows.length > 0) {
      result.push({ type: 'excel', name: name, rows: allRows });
    }
  }
  return result;
}

/* ---------- 指标映射 ---------- */
var TEMPLATE_METRICS = {
  revenue:    { label: '营业收入',     keywords: ['营业收入', '营业总收入', '主营业务收入'] },
  netProfit:  { label: '净利润',       keywords: ['净利润', '归属于母公司所有者的净利润'] },
  totalAsset: { label: '总资产',       keywords: ['资产总计', '总资产'] },
  totalLiab:  { label: '负债合计',     keywords: ['负债合计', '负债总计'] },
  equity:     { label: '所有者权益',   keywords: ['所有者权益合计', '股东权益合计', '净资产'] },
  grossProfit:{ label: '营业利润',     keywords: ['营业利润'] },
  operatingCF:{ label: '经营活动现金流', keywords: ['经营活动产生的现金流量净额', '经营活动现金流'] },
  grossMargin:{ label: '毛利率',       keywords: ['毛利率'] },
  roe:        { label: '净资产收益率', keywords: ['净资产收益率', 'ROE'] },
  roa:        { label: '总资产收益率', keywords: ['总资产收益率', 'ROA'] },
  currentRatio:{ label: '流动比率',    keywords: ['流动比率'] },
  quickRatio: { label: '速动比率',     keywords: ['速动比率'] },
  assetTurnover:{ label: '总资产周转率', keywords: ['总资产周转率'] },
  equityMultiplier:{ label: '权益乘数', keywords: ['权益乘数'] },
  costRevenue:{ label: '营业成本',     keywords: ['营业成本', '主营业务成本'] },
  netMargin:  { label: '净利率',       keywords: ['销售净利率', '净利率'] },
  eps:        { label: '每股收益',     keywords: ['基本每股收益', 'EPS'] },
  bps:        { label: '每股净资产',   keywords: ['每股净资产', 'BPS'] },
  debtRatio:  { label: '资产负债率',   keywords: ['资产负债率'] }
};

/* ---------- 数据提取 ---------- */
function extractMetricValue(rows, metricKey) {
  var metric = TEMPLATE_METRICS[metricKey];
  if (!metric) return null;
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row.length) continue;
    var label = String(row[0] || '');
    for (var k = 0; k < metric.keywords.length; k++) {
      if (label.indexOf(metric.keywords[k]) !== -1) {
        var raw = row.length > 1 ? row[1] : '';
        if (raw === '' || raw === undefined) raw = row[row.length - 1];
        var num = parseFloat(String(raw).replace(/,/g, ''));
        return isNaN(num) ? null : num;
      }
    }
  }
  return null;
}

function extractAllCompanyData(rows) {
  var result = {};
  for (var key in TEMPLATE_METRICS) {
    if (TEMPLATE_METRICS.hasOwnProperty(key)) {
      var val = extractMetricValue(rows, key);
      if (val !== null) result[key] = val;
    }
  }
  return result;
}

/* ---------- 杜邦分析模板 ---------- */
function generateDupontTemplate() {
  if (!requirePremium()) return;
  var files = convertExcelDataToArray();
  if (files.length === 0) { showBottomToast('请先采集Excel文件'); return; }

  var wb = XLSX.utils.book_new();
  var header = ['公司名称', '营业收入', '净利润', '总资产', '所有者权益', '营业成本', '净利率', '总资产周转率', '权益乘数', 'ROE(杜邦)'];
  var dataRows = [header];
  files.forEach(function(f) {
    var rows = f.rows || [];
    var rev = extractMetricValue(rows, 'revenue') || 0;
    var np = extractMetricValue(rows, 'netProfit') || 0;
    var ta = extractMetricValue(rows, 'totalAsset') || 0;
    var eq = extractMetricValue(rows, 'equity') || 0;
    var cost = extractMetricValue(rows, 'costRevenue') || 0;
    var netMargin = rev !== 0 ? (np / rev * 100) : 0;
    var assetTurn = ta !== 0 ? (rev / ta) : 0;
    var eqMult = eq !== 0 ? (ta / eq) : 0;
    var roe = netMargin * assetTurn * eqMult;
    dataRows.push([f.name, rev, np, ta, eq, cost, netMargin.toFixed(2) + '%', assetTurn.toFixed(4), eqMult.toFixed(4), roe.toFixed(2) + '%']);
  });
  var ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!cols'] = header.map(function() { return { wch: 18 }; });
  XLSX.utils.book_append_sheet(wb, ws, '杜邦分析');
  downloadXlsx(wb, '杜邦分析模板.xlsx');
}

/* ---------- 同行对比模板 ---------- */
function generatePeerCompareTemplate() {
  if (!requirePremium()) return;
  var files = convertExcelDataToArray();
  if (files.length < 2) { showBottomToast('至少需要2个Excel文件进行同行对比'); return; }

  var wb = XLSX.utils.book_new();
  var metricKeys = ['revenue', 'netProfit', 'totalAsset', 'totalLiab', 'equity', 'grossProfit', 'operatingCF', 'netMargin', 'roe', 'roa', 'debtRatio', 'currentRatio'];
  var header = ['指标'].concat(files.map(function(f) { return f.name; }));
  var dataRows = [header];
  metricKeys.forEach(function(key) {
    var row = [TEMPLATE_METRICS[key].label];
    files.forEach(function(f) {
      var val = extractMetricValue(f.rows || [], key);
      row.push(val !== null ? val : '-');
    });
    dataRows.push(row);
  });
  var ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!cols'] = header.map(function() { return { wch: 20 }; });
  XLSX.utils.book_append_sheet(wb, ws, '同行对比');
  downloadXlsx(wb, '同行对比模板.xlsx');
}

/* ---------- 多年趋势模板 ---------- */
function generateTrendTemplate() {
  if (!requirePremium()) return;
  var files = convertExcelDataToArray();
  if (files.length === 0) { showBottomToast('请先采集Excel文件'); return; }

  var wb = XLSX.utils.book_new();
  var metricKeys = ['revenue', 'netProfit', 'totalAsset', 'equity', 'operatingCF', 'roe', 'netMargin', 'debtRatio'];
  var header = ['指标'].concat(files.map(function(f) { return f.name; }));
  var dataRows = [header];
  metricKeys.forEach(function(key) {
    var row = [TEMPLATE_METRICS[key].label];
    files.forEach(function(f) {
      var val = extractMetricValue(f.rows || [], key);
      row.push(val !== null ? val : '-');
    });
    dataRows.push(row);
  });
  // 增长率sheet
  var growthHeader = ['指标'].concat(files.map(function(f) { return f.name; }));
  var growthRows = [growthHeader];
  var growthKeys = ['revenue', 'netProfit', 'totalAsset'];
  growthKeys.forEach(function(key) {
    var row = [TEMPLATE_METRICS[key].label + '增长率'];
    var prevVal = null;
    files.forEach(function(f) {
      var val = extractMetricValue(f.rows || [], key);
      if (prevVal !== null && val !== null && prevVal !== 0) {
        row.push(((val - prevVal) / Math.abs(prevVal) * 100).toFixed(2) + '%');
      } else {
        row.push('-');
      }
      prevVal = val;
    });
    growthRows.push(row);
  });
  var ws1 = XLSX.utils.aoa_to_sheet(dataRows);
  ws1['!cols'] = header.map(function() { return { wch: 20 }; });
  var ws2 = XLSX.utils.aoa_to_sheet(growthRows);
  ws2['!cols'] = growthHeader.map(function() { return { wch: 20 }; });
  XLSX.utils.book_append_sheet(wb, ws1, '多年趋势');
  XLSX.utils.book_append_sheet(wb, ws2, '增长率');
  downloadXlsx(wb, '多年趋势模板.xlsx');
}

/* ---------- 下载函数 ---------- */
function downloadXlsx(wb, filename) {
  var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  var blob = new Blob([wbout], { type: 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
