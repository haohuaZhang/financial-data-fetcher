// ==================== 图表可视化功能 ====================
let chartCurrentState = null; // 当前图表状态

function showChartArea(fileId) {
  const chartArea = document.getElementById('chartArea');
  const tableWrap = document.getElementById('excelTableWrap');
  if (!chartArea) return;
  if (tableWrap) tableWrap.style.display = 'none';
  chartArea.style.display = 'block';

  const file = collectedFiles.find(f => f.id === fileId);
  if (!file || !file.blob) {
    chartArea.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('chart-no-data') + '</div>';
    return;
  }

  // 读取当前活跃sheet
  const activeTab = document.querySelector('.excel-sheet-tabs .excel-sheet-tab.active:not([data-action="chart"])');
  const sheetName = activeTab ? activeTab.dataset.sheetName : null;

  const readAndShowChart = async () => {
    try {
      const arrayData = new Uint8Array(await file.blob.arrayBuffer());
      const workbook = XLSX.read(arrayData, { type: 'array' });
      const targetSheet = sheetName || workbook.SheetNames[0];
      const ws = workbook.Sheets[targetSheet];
      if (!ws) {
        chartArea.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('chart-no-data') + '</div>';
        return;
      }
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) {
        chartArea.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('chart-no-data') + '</div>';
        return;
      }

      const headers = rows[0] || [];
      // 找出数值列（跳过第一列作为标签）
      const numericCols = [];
      for (let c = 1; c < headers.length; c++) {
        let numCount = 0;
        for (let r = 1; r < Math.min(rows.length, 20); r++) {
          const val = rows[r] && rows[r][c];
          if (val !== '' && val !== undefined && !isNaN(parseFloat(String(val).replace(/,/g, '')))) numCount++;
        }
        if (numCount > 1) numericCols.push(c);
      }

      if (numericCols.length === 0) {
        chartArea.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('chart-no-data') + '</div>';
        return;
      }

      // 保存状态
      chartCurrentState = { fileId, sheetName: targetSheet, rows, headers, numericCols };

      // 渲染列选择器和Canvas
      let html = '<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;">';
      html += '<label style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;">' + t('chart-select-col') + ':</label>';
      html += '<select id="chartColSelect" style="flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);font-family:inherit;font-size:0.8rem;">';
      numericCols.forEach(c => {
        html += `<option value="${c}" ${c === numericCols[0] ? 'selected' : ''}>${escapeHtml(String(headers[c] || t('compare-col-idx') + c))}</option>`;
      });
      html += '</select></div>';
      html += '<canvas id="chartCanvas" style="width:100%;border:1px solid var(--border-color);border-radius:var(--radius);background:var(--bg-card);"></canvas>';
      chartArea.innerHTML = html;

      // 绑定列选择事件
      document.getElementById('chartColSelect').addEventListener('change', function() {
        renderChart(document.getElementById('chartCanvas'), headers, rows, parseInt(this.value));
      });

      // 渲染默认图表
      renderChart(document.getElementById('chartCanvas'), headers, rows, numericCols[0]);
    } catch (e) {
      chartArea.innerHTML = '<div style="padding:40px;text-align:center;color:var(--error);">' + t('file-preview-render-fail') + ': ' + escapeHtml(e.message) + '</div>';
    }
  };
  readAndShowChart();
}

function renderChart(canvas, headers, rows, selectedColIndex) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const containerWidth = canvas.parentElement.clientWidth - 32;
  const dpr = window.devicePixelRatio || 1;
  const width = containerWidth;
  const height = 320;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);

  // 获取当前主题accent色
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f46e5';
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1a1a1a';
  const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#9b9b9b';
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e8e8e6';
  const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#16a34a';
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--error').trim() || '#dc2626';

  // 提取数据
  const labels = [];
  const values = [];
  const maxItems = 30; // 最多显示30个柱子
  for (let r = 1; r < Math.min(rows.length, maxItems + 1); r++) {
    const label = rows[r] ? String(rows[r][0] || '') : '';
    const rawVal = rows[r] && rows[r][selectedColIndex] !== undefined ? String(rows[r][selectedColIndex]) : '';
    const numVal = parseFloat(rawVal.replace(/,/g, ''));
    if (label.trim() && !isNaN(numVal)) {
      labels.push(label.length > 10 ? label.substring(0, 10) + '...' : label);
      values.push(numVal);
    }
  }

  if (values.length === 0) {
    ctx.fillStyle = textMuted;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('chart-no-data'), width / 2, height / 2);
    return;
  }

  // 图表区域
  const padding = { top: 30, right: 20, bottom: 60, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // 清除
  ctx.clearRect(0, 0, width, height);

  // 计算值范围
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const niceMax = Math.ceil(maxVal / Math.pow(10, Math.floor(Math.log10(Math.abs(maxVal) || 1)))) * Math.pow(10, Math.floor(Math.log10(Math.abs(maxVal) || 1)));
  const niceMin = minVal >= 0 ? 0 : Math.floor(minVal / Math.pow(10, Math.floor(Math.log10(Math.abs(minVal) || 1)))) * Math.pow(10, Math.floor(Math.log10(Math.abs(minVal) || 1)));
  const niceRange = niceMax - niceMin || 1;

  // 绘制Y轴网格线
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  ctx.fillStyle = textMuted;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = niceMin + (niceRange * i / yTicks);
    const y = padding.top + chartH - (chartH * i / yTicks);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(yVal.toLocaleString(), padding.left - 8, y + 4);
  }

  // 绘制柱状图
  const barWidth = Math.max(4, Math.min(40, (chartW / values.length) * 0.7));
  const barGap = chartW / values.length;

  values.forEach((val, i) => {
    const x = padding.left + barGap * i + (barGap - barWidth) / 2;
    const barH = Math.abs(val - niceMin) / niceRange * chartH;
    const y = val >= 0
      ? padding.top + chartH - barH
      : padding.top + chartH;

    // 渐变色
    const gradient = ctx.createLinearGradient(x, y, x, y + barH);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(1, accentColor + '88');
    ctx.fillStyle = gradient;

    // 圆角矩形
    const radius = Math.min(3, barWidth / 4);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();

    // X轴标签
    ctx.fillStyle = textMuted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartH + 8);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(labels[i], 0, 0);
    ctx.restore();
  });

  // 标题
  ctx.fillStyle = textColor;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(headers[selectedColIndex] || ''), width / 2, 18);
}
