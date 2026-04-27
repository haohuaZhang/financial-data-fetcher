// ==================== 数据对比功能 ====================

/* ---------- 格式化数字 ---------- */
function formatCompareNum(val) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  var abs = Math.abs(val);
  if (abs >= 1e8) return (val / 1e8).toFixed(2) + '亿';
  if (abs >= 1e4) return (val / 1e4).toFixed(2) + '万';
  return val.toFixed(2);
}

/* ---------- 快速对比（从已解析数据直接对比） ---------- */
function openQuickCompare() {
  if (!requirePremium()) return;
  var files = (window.__latestExcelData || []).filter(function(f) { return f.type === 'excel'; });
  if (files.length < 2) {
    showBottomToast(t('compare-need-two'));
    return;
  }
  var modal = document.getElementById('compareModal');
  var body = document.getElementById('compareBody');
  if (!modal || !body) return;
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);"><span class="spinner"></span> ' + t('file-preview-loading') + '</div>';
  modal.classList.add('active');
  performQuickCompare(files);
}

/* ---------- 快速对比核心逻辑 ---------- */
function performQuickCompare(files) {
  var body = document.getElementById('compareBody');
  try {
    var metricKeywords = ['营业收入', '净利润', '总资产', '总负债', '营业利润', '利润总额', '营业成本', '经营活动现金流', '投资活动现金流', '筹资活动现金流', '资产总计', '负债合计', '所有者权益合计', '营业收入合计', '净利润合计'];

    // 收集所有匹配指标
    var matchedMetrics = [];
    files.forEach(function(fd) {
      var rows = fd.rows || [];
      var headerRow = rows[0] || [];
      for (var c = 0; c < headerRow.length; c++) {
        var cellText = String(headerRow[c]);
        for (var k = 0; k < metricKeywords.length; k++) {
          var kw = metricKeywords[k];
          if (cellText.indexOf(kw) !== -1 && !matchedMetrics.some(function(m) { return m.colIndex === c && m.keyword === kw; })) {
            matchedMetrics.push({ colIndex: c, keyword: kw });
          }
        }
      }
    });

    var compareCols = [];
    if (matchedMetrics.length > 0) {
      compareCols = matchedMetrics.map(function(m) { return m.colIndex; });
    } else {
      var headerRow = (files[0].rows || [])[0] || [];
      for (var c = 1; c < headerRow.length; c++) {
        var numCount = 0;
        for (var r = 1; r < Math.min(files[0].rows.length, 20); r++) {
          var val = files[0].rows[r] && files[0].rows[r][c];
          if (val !== '' && val !== undefined && !isNaN(parseFloat(String(val).replace(/,/g, '')))) numCount++;
        }
        if (numCount > 2) compareCols.push(c);
      }
    }

    if (compareCols.length === 0) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('compare-no-match') + '</div>';
      return;
    }

    var html = '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">';
    html += '<span style="font-size:0.8rem;color:var(--text-secondary);">' + t('compare-source') + ': ' + files.map(function(fd) { return escapeHtml(fd.name); }).join(' vs ') + '</span>';
    html += '<button class="btn-file-action primary-action" onclick="exportCompareExcel()" style="font-size:0.75rem;padding:4px 12px;">导出Excel</button>';
    html += '</div>';

    // 存储对比数据供导出使用
    window.__compareData = { files: files, compareCols: compareCols };

    for (var ci = 0; ci < compareCols.length; ci++) {
      var colIdx = compareCols[ci];
      var colName = String(((files[0].rows || [])[0] || [])[colIdx] || t('compare-col-idx') + colIdx);
      html += '<div style="margin-bottom:20px;">';
      html += '<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--accent-text);">' + escapeHtml(colName) + '</div>';
      html += '<table class="excel-table compare-table" style="font-size:0.78rem;">';
      html += '<thead><tr>';
      html += '<th>' + t('compare-metric') + '</th>';
      for (var fi = 0; fi < files.length; fi++) {
        html += '<th>' + escapeHtml(files[fi].name.substring(0, 30)) + '</th>';
      }
      if (files.length >= 2) {
        html += '<th class="sortable" onclick="sortCompareTable(this,\'change\')">' + t('compare-change') + ' <span class="sort-arrow"></span></th>';
        html += '<th class="sortable" onclick="sortCompareTable(this,\'rate\')">' + t('compare-rate') + ' <span class="sort-arrow"></span></th>';
      }
      html += '</tr></thead><tbody>';

      var maxRows = Math.max.apply(null, files.map(function(fd) { return (fd.rows || []).length; }));
      for (var r = 1; r < Math.min(maxRows, 100); r++) {
        var label = files[0].rows && files[0].rows[r] ? String(files[0].rows[r][0] || '') : '';
        if (!label.trim()) continue;

        var values = files.map(function(fd) {
          var raw = fd.rows && fd.rows[r] && fd.rows[r][colIdx] !== undefined ? String(fd.rows[r][colIdx]) : '';
          var num = parseFloat(raw.replace(/,/g, ''));
          return { raw: raw, num: isNaN(num) ? null : num };
        });

        if (values.every(function(v) { return v.num === null; })) continue;

        html += '<tr>';
        html += '<td style="font-weight:500;">' + escapeHtml(label) + '</td>';
        for (var vi = 0; vi < values.length; vi++) {
          html += '<td style="text-align:right;">' + (values[vi].raw || '-') + '</td>';
        }
        if (files.length >= 2) {
          var v1 = values[0].num;
          var v2 = values[1].num;
          if (v1 !== null && v2 !== null) {
            var change = v2 - v1;
            var rate = v1 !== 0 ? (change / Math.abs(v1) * 100) : (v2 !== 0 ? Infinity : 0);
            var color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--error)' : 'var(--text-muted)';
            var arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
            html += '<td style="text-align:right;color:' + color + ';" data-change="' + change + '">' + arrow + ' ' + (change >= 0 ? '+' : '') + formatCompareNum(change) + '</td>';
            if (rate === Infinity) {
              html += '<td style="text-align:right;color:var(--success);" data-rate="999999">+∞</td>';
            } else if (rate === -Infinity) {
              html += '<td style="text-align:right;color:var(--error);" data-rate="-999999">-∞</td>';
            } else {
              html += '<td style="text-align:right;color:' + color + ';" data-rate="' + rate + '">' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '%</td>';
            }
          } else {
            html += '<td>-</td><td>-</td>';
          }
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--error);">' + t('file-preview-render-fail') + ': ' + escapeHtml(e.message) + '</div>';
  }
}

/* ---------- 表头排序 ---------- */
function sortCompareTable(thEl, sortKey) {
  var table = thEl.closest('table');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  if (!tbody) return;
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  var asc = thEl.classList.contains('sort-asc');
  // 清除所有排序状态
  table.querySelectorAll('.sortable').forEach(function(th) {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  th.classList.add(asc ? 'sort-desc' : 'sort-asc');

  rows.sort(function(a, b) {
    var aVal = parseFloat(a.querySelector('[data-' + sortKey + ']') ? a.querySelector('[data-' + sortKey + ']').getAttribute('data-' + sortKey) : '0');
    var bVal = parseFloat(b.querySelector('[data-' + sortKey + ']') ? b.querySelector('[data-' + sortKey + ']').getAttribute('data-' + sortKey) : '0');
    return asc ? bVal - aVal : aVal - bVal;
  });
  rows.forEach(function(row) { tbody.appendChild(row); });
}

/* ---------- 导出对比Excel ---------- */
function exportCompareExcel() {
  if (!requirePremium()) return;
  var cd = window.__compareData;
  if (!cd || !cd.files || cd.files.length < 2) { showBottomToast('无对比数据可导出'); return; }

  var wb = XLSX.utils.book_new();
  var files = cd.files;
  var compareCols = cd.compareCols;

  for (var ci = 0; ci < compareCols.length; ci++) {
    var colIdx = compareCols[ci];
    var colName = String(((files[0].rows || [])[0] || [])[colIdx] || '指标' + colIdx);
    var header = ['指标'];
    for (var fi = 0; fi < files.length; fi++) header.push(files[fi].name.substring(0, 30));
    if (files.length >= 2) { header.push('变动额'); header.push('变动率'); }
    var dataRows = [header];

    var maxRows = Math.max.apply(null, files.map(function(fd) { return (fd.rows || []).length; }));
    for (var r = 1; r < Math.min(maxRows, 100); r++) {
      var label = files[0].rows && files[0].rows[r] ? String(files[0].rows[r][0] || '') : '';
      if (!label.trim()) continue;
      var values = files.map(function(fd) {
        var raw = fd.rows && fd.rows[r] && fd.rows[r][colIdx] !== undefined ? String(fd.rows[r][colIdx]) : '';
        var num = parseFloat(raw.replace(/,/g, ''));
        return { raw: raw, num: isNaN(num) ? null : num };
      });
      if (values.every(function(v) { return v.num === null; })) continue;
      var row = [label];
      for (var vi = 0; vi < values.length; vi++) row.push(values[vi].num !== null ? values[vi].num : '');
      if (files.length >= 2 && values[0].num !== null && values[1].num !== null) {
        var change = values[1].num - values[0].num;
        var rate = values[0].num !== 0 ? (change / Math.abs(values[0].num) * 100) : 0;
        row.push(change);
        row.push(parseFloat(rate.toFixed(2)) + '%');
      }
      dataRows.push(row);
    }
    var ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws['!cols'] = header.map(function() { return { wch: 20 }; });
    XLSX.utils.book_append_sheet(wb, ws, colName.substring(0, 31));
  }

  var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  var blob = new Blob([wbout], { type: 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '数据对比_' + Date.now() + '.xlsx';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

/* ---------- 原有对比弹窗（从文件选择） ---------- */
function openCompareModal() {
  var selectedExcelFiles = collectedFiles.filter(function(f) { return f.type === 'excel' && f._selected; });
  if (selectedExcelFiles.length < 2) {
    showBottomToast(t('compare-need-two'));
    return;
  }
  var modal = document.getElementById('compareModal');
  var body = document.getElementById('compareBody');
  if (!modal || !body) return;
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);"><span class="spinner"></span> ' + t('file-preview-loading') + '</div>';
  modal.classList.add('active');
  performCompare(selectedExcelFiles);
}

function closeCompareModal() {
  var modal = document.getElementById('compareModal');
  if (modal) modal.classList.remove('active');
}

// 点击遮罩关闭对比模态框
var compareModalEl = document.getElementById('compareModal');
if (compareModalEl) {
  compareModalEl.addEventListener('click', function(e) {
    if (e.target === this) closeCompareModal();
  });
}

async function performCompare(files) {
  var body = document.getElementById('compareBody');
  try {
    var fileDataList = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var data = new Uint8Array(await file.blob.arrayBuffer());
      var workbook = XLSX.read(data, { type: 'array' });
      var firstSheet = workbook.SheetNames[0];
      if (!firstSheet) continue;
      var ws = workbook.Sheets[firstSheet];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      fileDataList.push({ name: file.name, rows: rows });
    }
    if (fileDataList.length < 2) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('compare-need-two') + '</div>';
      return;
    }
    performQuickCompare(fileDataList);
  } catch (e) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--error);">' + t('file-preview-render-fail') + ': ' + escapeHtml(e.message) + '</div>';
  }
}
