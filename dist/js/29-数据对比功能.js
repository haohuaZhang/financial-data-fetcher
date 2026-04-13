// ==================== 数据对比功能 ====================
function openCompareModal() {
  const selectedExcelFiles = collectedFiles.filter(f => f.type === 'excel' && f._selected);
  if (selectedExcelFiles.length < 2) {
    showBottomToast(t('compare-need-two'));
    return;
  }
  const modal = document.getElementById('compareModal');
  const body = document.getElementById('compareBody');
  if (!modal || !body) return;
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);"><span class="spinner"></span> ' + t('file-preview-loading') + '</div>';
  modal.classList.add('active');
  performCompare(selectedExcelFiles);
}

function closeCompareModal() {
  const modal = document.getElementById('compareModal');
  if (modal) modal.classList.remove('active');
}

// 点击遮罩关闭对比模态框
const compareModalEl = document.getElementById('compareModal');
if (compareModalEl) {
  compareModalEl.addEventListener('click', function(e) {
    if (e.target === this) closeCompareModal();
  });
}

async function performCompare(files) {
  const body = document.getElementById('compareBody');
  try {
    // 读取所有文件的第一个sheet
    const fileDataList = [];
    for (const file of files) {
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) continue;
      const ws = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      fileDataList.push({ name: file.name, rows: rows });
    }
    if (fileDataList.length < 2) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('compare-need-two') + '</div>';
      return;
    }

    // 财务指标关键词
    const metricKeywords = ['营业收入', '净利润', '总资产', '总负债', '营业利润', '利润总额', '营业成本', '经营活动现金流', '投资活动现金流', '筹资活动现金流', '资产总计', '负债合计', '所有者权益合计', '营业收入合计', '净利润合计'];

    // 找到匹配的指标列
    let matchedMetrics = [];
    for (const fd of fileDataList) {
      const headerRow = fd.rows[0] || [];
      for (let c = 0; c < headerRow.length; c++) {
        const cellText = String(headerRow[c]);
        for (const kw of metricKeywords) {
          if (cellText.includes(kw) && !matchedMetrics.some(m => m.colIndex === c && m.keyword === kw)) {
            matchedMetrics.push({ colIndex: c, keyword: kw });
          }
        }
      }
    }

    // 如果没有匹配到关键词，找所有数值列
    let compareCols = [];
    if (matchedMetrics.length > 0) {
      compareCols = matchedMetrics.map(m => m.colIndex);
    } else {
      // 找所有数值列
      const headerRow = fileDataList[0].rows[0] || [];
      for (let c = 1; c < headerRow.length; c++) {
        // 检查该列是否大部分是数值
        let numCount = 0;
        for (let r = 1; r < Math.min(fileDataList[0].rows.length, 20); r++) {
          const val = fileDataList[0].rows[r] && fileDataList[0].rows[r][c];
          if (val !== '' && val !== undefined && !isNaN(parseFloat(String(val).replace(/,/g, '')))) {
            numCount++;
          }
        }
        if (numCount > 2) compareCols.push(c);
      }
    }

    if (compareCols.length === 0) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('compare-no-match') + '</div>';
      return;
    }

    // 构建对比表格
    let html = '<div style="margin-bottom:12px;font-size:0.8rem;color:var(--text-secondary);">';
    html += t('compare-source') + ': ' + fileDataList.map(fd => escapeHtml(fd.name)).join(' vs ');
    if (matchedMetrics.length === 0) html += ' ' + t('compare-all-numeric');
    html += '</div>';

    // 为每个对比列生成一个小表格
    for (const colIdx of compareCols) {
      const colName = String((fileDataList[0].rows[0] || [])[colIdx] || t('compare-col-idx') + colIdx);
      html += '<div style="margin-bottom:20px;">';
      html += '<div style="font-size:0.85rem;font-weight:600;margin-bottom:8px;color:var(--accent-text);">' + escapeHtml(colName) + '</div>';
      html += '<table class="excel-table" style="font-size:0.78rem;">';
      html += '<thead><tr>';
      html += '<th>' + t('compare-metric') + '</th>';
      for (const fd of fileDataList) {
        html += '<th>' + escapeHtml(fd.name.substring(0, 30)) + '</th>';
      }
      if (fileDataList.length >= 2) {
        html += '<th>' + t('compare-change') + '</th>';
        html += '<th>' + t('compare-rate') + '</th>';
      }
      html += '</tr></thead><tbody>';

      // 收集该列所有行的标签和值
      const labelCol = 0; // 第一列作为标签
      const maxRows = Math.max(...fileDataList.map(fd => fd.rows.length));
      for (let r = 1; r < Math.min(maxRows, 100); r++) {
        const label = fileDataList[0].rows[r] ? String(fileDataList[0].rows[r][labelCol] || '') : '';
        if (!label.trim()) continue;

        const values = fileDataList.map(fd => {
          const raw = fd.rows[r] && fd.rows[r][colIdx] !== undefined ? String(fd.rows[r][colIdx]) : '';
          const num = parseFloat(raw.replace(/,/g, ''));
          return { raw, num: isNaN(num) ? null : num };
        });

        // 至少有一个数值才显示
        if (values.every(v => v.num === null)) continue;

        html += '<tr>';
        html += '<td style="font-weight:500;">' + escapeHtml(label) + '</td>';
        for (const v of values) {
          html += '<td style="text-align:right;">' + (v.raw || '-') + '</td>';
        }
        if (fileDataList.length >= 2) {
          const v1 = values[0].num;
          const v2 = values[1].num;
          if (v1 !== null && v2 !== null) {
            const change = v2 - v1;
            const rate = v1 !== 0 ? (change / Math.abs(v1) * 100) : (v2 !== 0 ? Infinity : 0);
            const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--error)' : 'var(--text-muted)';
            const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
            html += '<td style="text-align:right;color:' + color + ';">' + arrow + ' ' + (change >= 0 ? '+' : '') + change.toFixed(2) + '</td>';
            if (rate === Infinity) {
              html += '<td style="text-align:right;color:var(--success);">+∞</td>';
            } else if (rate === -Infinity) {
              html += '<td style="text-align:right;color:var(--error);">-∞</td>';
            } else {
              html += '<td style="text-align:right;color:' + color + ';">' + (rate >= 0 ? '+' : '') + rate.toFixed(2) + '%</td>';
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
