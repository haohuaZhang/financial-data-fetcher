// ==================== 可视化图表报告 ====================

var __echartsLoaded = false;
var __echartsLoading = false;

/* ---------- 动态加载 ECharts CDN ---------- */
function loadECharts(callback) {
  if (window.echarts) { __echartsLoaded = true; if (callback) callback(); return; }
  if (__echartsLoading) { setTimeout(function() { loadECharts(callback); }, 200); return; }
  __echartsLoading = true;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
  script.onload = function() { __echartsLoaded = true; __echartsLoading = false; if (callback) callback(); };
  script.onerror = function() { __echartsLoading = false; showBottomToast('图表库加载失败，请检查网络'); };
  document.head.appendChild(script);
}

/* ---------- 数据提取 ---------- */
function extractChartData(files, metricKey) {
  var metric = (typeof TEMPLATE_METRICS !== 'undefined') ? TEMPLATE_METRICS[metricKey] : null;
  if (!metric) return { names: [], values: [] };
  var names = [];
  var values = [];
  files.forEach(function(f) {
    var rows = f.rows || [];
    var val = null;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var label = String(row[0] || '');
      for (var k = 0; k < metric.keywords.length; k++) {
        if (label.indexOf(metric.keywords[k]) !== -1) {
          var raw = row.length > 1 ? row[1] : '';
          if (raw === '' || raw === undefined) raw = row[row.length - 1];
          var num = parseFloat(String(raw).replace(/,/g, ''));
          if (!isNaN(num)) val = num;
          break;
        }
      }
      if (val !== null) break;
    }
    names.push(f.name.replace(/\.[^.]+$/, ''));
    values.push(val);
  });
  return { names: names, values: values };
}

function findMetricInRows(rows, keywords) {
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row.length) continue;
    var label = String(row[0] || '');
    for (var k = 0; k < keywords.length; k++) {
      if (label.indexOf(keywords[k]) !== -1) {
        var raw = row.length > 1 ? row[1] : '';
        if (raw === '' || raw === undefined) raw = row[row.length - 1];
        var num = parseFloat(String(raw).replace(/,/g, ''));
        return isNaN(num) ? null : num;
      }
    }
  }
  return null;
}

/* ---------- 切换到图表子Tab ---------- */
function switchToChartTab() {
  if (!requirePremium()) return;
  switchFinanceSubTab('chart');
  loadECharts(function() {
    setTimeout(renderAllCharts, 100);
  });
}

/* ---------- 渲染所有图表 ---------- */
function renderAllCharts() {
  if (!window.echarts) return;
  var files = (window.__latestExcelData || []).filter(function(f) { return f.type === 'excel'; });
  if (files.length === 0) {
    var containers = document.querySelectorAll('.chart-container');
    containers.forEach(function(c) { c.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.85rem;">暂无数据</div>'; });
    return;
  }
  renderTrendChart(files);
  renderBarCompareChart(files);
  renderRadarChart(files);
}

/* ---------- 折线图：多年趋势 ---------- */
function renderTrendChart(files) {
  var container = document.getElementById('chartTrend');
  if (!container) return;
  var chart = echarts.init(container);
  var metrics = ['revenue', 'netProfit', 'operatingCF'];
  var series = [];
  var colors = ['#4f46e5', '#16a34a', '#d97706'];
  metrics.forEach(function(key, idx) {
    var data = extractChartData(files, key);
    series.push({
      name: (typeof TEMPLATE_METRICS !== 'undefined') ? TEMPLATE_METRICS[key].label : key,
      type: 'line',
      data: data.values,
      smooth: true,
      lineStyle: { color: colors[idx], width: 2 },
      itemStyle: { color: colors[idx] }
    });
  });
  var names = extractChartData(files, 'revenue').names;
  chart.setOption({
    title: { text: '多年趋势', left: 'center', textStyle: { fontSize: 14, color: '#1a1a1a' } },
    tooltip: { trigger: 'axis', formatter: function(params) {
      var s = params[0].axisValue + '<br/>';
      params.forEach(function(p) { s += p.marker + p.seriesName + ': ' + formatChartNum(p.value) + '<br/>'; });
      return s;
    }},
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 40, right: 20, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: function(v) { return formatChartNum(v); } } },
    series: series
  });
  window.addEventListener('resize', function() { chart.resize(); });
}

/* ---------- 柱状图：同行对比 ---------- */
function renderBarCompareChart(files) {
  var container = document.getElementById('chartBarCompare');
  if (!container) return;
  var chart = echarts.init(container);
  var metrics = ['revenue', 'netProfit', 'totalAsset'];
  var names = extractChartData(files, 'revenue').names;
  var series = [];
  var colors = ['#4f46e5', '#16a34a', '#d97706'];
  metrics.forEach(function(key, idx) {
    var data = extractChartData(files, key);
    series.push({
      name: (typeof TEMPLATE_METRICS !== 'undefined') ? TEMPLATE_METRICS[key].label : key,
      type: 'bar',
      data: data.values,
      itemStyle: { color: colors[idx], borderRadius: [4, 4, 0, 0] }
    });
  });
  chart.setOption({
    title: { text: '同行对比', left: 'center', textStyle: { fontSize: 14, color: '#1a1a1a' } },
    tooltip: { trigger: 'axis', formatter: function(params) {
      var s = params[0].axisValue + '<br/>';
      params.forEach(function(p) { s += p.marker + p.seriesName + ': ' + formatChartNum(p.value) + '<br/>'; });
      return s;
    }},
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 40, right: 20, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: function(v) { return formatChartNum(v); } } },
    series: series
  });
  window.addEventListener('resize', function() { chart.resize(); });
}

/* ---------- 雷达图：综合指标 ---------- */
function renderRadarChart(files) {
  var container = document.getElementById('chartRadar');
  if (!container) return;
  var chart = echarts.init(container);
  var radarMetrics = ['revenue', 'netProfit', 'totalAsset', 'equity', 'operatingCF'];
  var indicator = [];
  radarMetrics.forEach(function(key) {
    var label = (typeof TEMPLATE_METRICS !== 'undefined') ? TEMPLATE_METRICS[key].label : key;
    var maxVal = 0;
    files.forEach(function(f) {
      var data = extractChartData([f], key);
      if (data.values[0] !== null && data.values[0] > maxVal) maxVal = data.values[0];
    });
    indicator.push({ name: label, max: maxVal * 1.2 || 100 });
  });
  var seriesData = [];
  var colors = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#2563eb'];
  files.slice(0, 5).forEach(function(f, idx) {
    var values = [];
    radarMetrics.forEach(function(key) {
      var data = extractChartData([f], key);
      values.push(data.values[0] || 0);
    });
    seriesData.push({
      value: values,
      name: f.name.replace(/\.[^.]+$/, ''),
      lineStyle: { color: colors[idx % colors.length] },
      itemStyle: { color: colors[idx % colors.length] },
      areaStyle: { color: colors[idx % colors.length], opacity: 0.1 }
    });
  });
  chart.setOption({
    title: { text: '综合指标雷达图', left: 'center', textStyle: { fontSize: 14, color: '#1a1a1a' } },
    tooltip: {},
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    radar: { indicator: indicator, radius: '60%', center: ['50%', '50%'] },
    series: [{ type: 'radar', data: seriesData }]
  });
  window.addEventListener('resize', function() { chart.resize(); });
}

/* ---------- 导出PNG ---------- */
function exportChartPng(chartId) {
  if (!requirePremium()) return;
  var container = document.getElementById(chartId);
  if (!container) return;
  var chartInstance = echarts.getInstanceByDom(container);
  if (!chartInstance) { showBottomToast('图表未渲染'); return; }
  var url = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  var a = document.createElement('a');
  a.href = url;
  a.download = chartId + '_' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); }, 100);
}

/* ---------- 格式化数字 ---------- */
function formatChartNum(val) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  var abs = Math.abs(val);
  if (abs >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toFixed(2);
}
