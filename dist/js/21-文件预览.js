// ==================== 文件预览 ====================

async function previewFile(fileId) {
  const file = collectedFiles.find(f => f.id === fileId);
  if (!file) return;

  const modal = document.getElementById('previewModal');
  const title = document.getElementById('previewTitle');
  const body = document.getElementById('previewBody');

  title.textContent = file.name;
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);"><span class="spinner"></span> ' + t('file-preview-loading') + '</div>';
  modal.classList.add('active');

  if (file.type === 'excel') {
    try {
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const workbook = XLSX.read(data, { type: 'array' });

      if (workbook.SheetNames.length === 0) {
        body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('file-preview-empty') + '</div>';
        return;
      }

      // 显示sheet数量提示
      let html = `<div style="padding:8px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);font-size:0.75rem;color:var(--text-muted);">
        ${t('file-preview-sheets').replace('{n}', workbook.SheetNames.length)}
      </div>`;
      
      html += '<div class="excel-sheet-tabs" data-file-id="' + fileId + '">';
      workbook.SheetNames.forEach((name, idx) => {
        const displayName = name || `Sheet ${idx + 1}`;
        // BUG-A05: 使用data属性替代内联onclick，避免sheetName含特殊字符导致语法错误
        html += `<button class="excel-sheet-tab ${idx === 0 ? 'active' : ''}" data-sheet-name="${escapeHtml(name)}" data-sheet-idx="${idx}">${escapeHtml(displayName)}</button>`;
      });
      // 添加图表标签
      html += `<button class="excel-sheet-tab" id="chartTabBtn" data-action="chart" style="margin-left:8px;">${t('chart-tab')}</button>`;
      html += '</div>';
      html += `<div class="excel-table-wrap" id="excelTableWrap"></div>`;
      html += `<div id="chartArea" style="display:none;padding:16px;"></div>`;
      body.innerHTML = html;

      // 存储预览状态用于键盘切换sheet
      currentPreviewState = { fileId, sheetNames: workbook.SheetNames };
      renderExcelSheet(workbook.SheetNames[0], fileId);
    } catch (e) {
      body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--error);">${t('file-preview-fail')}: ${escapeHtml(e.message)}</div>`;
    }
  } else if (file.type === 'pdf') {
    // iframe无法正确加载blob PDF，改为新窗口打开
    const blobUrl = URL.createObjectURL(file.blob);
    currentPdfBlobUrl = blobUrl;
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
      <div style="font-size:3rem;">📄</div>
      <div style="color:var(--text-secondary);font-size:0.9rem;">${t('file-preview-pdf-ready')}</div>
      <div style="color:var(--text-muted);font-size:0.8rem;">${t('file-preview-pdf-size')} ${formatFileSize(file.size)}</div>
      <button onclick="window.open('${blobUrl}', '_blank')" style="margin-top:8px;padding:10px 28px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-size:0.9rem;font-family:inherit;">${t('file-preview-pdf-btn')}</button>
    </div>`;
  } else if (file.type === 'pdf-link') {
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
      <div style="font-size:3rem;">🔗</div>
      <div style="color:var(--text-secondary);font-size:0.9rem;">${t('file-preview-link-need')}</div>
      <div style="color:var(--text-muted);font-size:0.8rem;word-break:break-all;max-width:80%;text-align:center;">${escapeHtml(file.url)}</div>
      <a href="${file.url}" target="_blank" rel="noopener" style="margin-top:8px;padding:10px 28px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-size:0.9rem;text-decoration:none;">${t('file-preview-link-btn')}</a>
    </div>`;
  }
}

function switchExcelSheet(tabEl, sheetName, fileId) {
  tabEl.parentElement.querySelectorAll('.excel-sheet-tab').forEach(el => el.classList.remove('active'));
  tabEl.classList.add('active');
  renderExcelSheet(sheetName, fileId);
}

// BUG-A05: 使用事件委托处理Excel sheet标签点击（避免内联onclick特殊字符问题）
document.addEventListener('click', function(e) {
  const tab = e.target.closest('.excel-sheet-tab');
  if (!tab) return;
  const tabsContainer = tab.closest('.excel-sheet-tabs');
  if (!tabsContainer) return;

  // 处理图表标签点击
  if (tab.dataset.action === 'chart') {
    tabsContainer.querySelectorAll('.excel-sheet-tab').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    const fileId = parseInt(tabsContainer.dataset.fileId);
    showChartArea(fileId);
    return;
  }

  const fileId = parseInt(tabsContainer.dataset.fileId);
  const sheetName = tab.dataset.sheetName;
  if (sheetName !== undefined && !isNaN(fileId)) {
    switchExcelSheet(tab, sheetName, fileId);
    // 切换回sheet时隐藏图表区域
    const chartArea = document.getElementById('chartArea');
    const tableWrap = document.getElementById('excelTableWrap');
    if (chartArea) chartArea.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';
  }
});

// 当前Excel预览的筛选排序状态
let excelFilterState = { searchText: '', sortCol: -1, sortDir: 'asc', allRows: null, headerRow: null };

function filterAndSortTable(headerRow, dataRows, searchText, sortCol, sortDir) {
  let filtered = dataRows;
  if (searchText) {
    const lowerSearch = searchText.toLowerCase();
    filtered = filtered.filter(row => row.some(cell => String(cell).toLowerCase().includes(lowerSearch)));
  }
  if (sortCol >= 0) {
    filtered = [...filtered].sort((a, b) => {
      const va = a[sortCol] !== undefined ? a[sortCol] : '';
      const vb = b[sortCol] !== undefined ? b[sortCol] : '';
      const na = parseFloat(String(va).replace(/,/g, ''));
      const nb = parseFloat(String(vb).replace(/,/g, ''));
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === 'asc' ? na - nb : nb - na;
      }
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }
  return filtered;
}

function renderExcelSheet(sheetName, fileId) {
  const file = collectedFiles.find(f => f.id === fileId);
  if (!file) return;

  const wrap = document.getElementById('excelTableWrap');
  if (!wrap) return;

  // 重置筛选状态
  excelFilterState = { searchText: '', sortCol: -1, sortDir: 'asc', allRows: null, headerRow: null };

  const readAndRender = async () => {
    try {
      const arrayData = new Uint8Array(await file.blob.arrayBuffer());
      const workbook = XLSX.read(arrayData, { type: 'array' });
      const ws = workbook.Sheets[sheetName];
      if (!ws) {
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('file-preview-no-sheet') + '</div>';
        return;
      }
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length === 0) {
        wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">' + t('file-preview-empty-sheet') + '</div>';
        return;
      }

      const headerRow = rows[0] || [];
      const dataRows = rows.slice(1);

      // 保存完整数据
      excelFilterState.allRows = dataRows;
      excelFilterState.headerRow = headerRow;

      // 渲染搜索栏和表格
      renderFilteredExcel(wrap, headerRow, dataRows);
    } catch (e) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--error);">${t('file-preview-render-fail')}: ${escapeHtml(e.message)}</div>`;
    }
  };

  readAndRender();
}

function renderFilteredExcel(wrap, headerRow, dataRows) {
  const maxRows = Math.min(dataRows.length, 500);
  const filtered = filterAndSortTable(headerRow, dataRows, excelFilterState.searchText, excelFilterState.sortCol, excelFilterState.sortDir);
  const displayRows = filtered.slice(0, maxRows);

  let html = '<div class="data-filter-bar">';
  html += `<input type="text" id="excelSearchInput" placeholder="${t('data-search-placeholder')}" value="${escapeHtml(excelFilterState.searchText)}">`;
  html += `<span class="data-filter-info">${t('data-showing').replace('{n}', displayRows.length).replace('{total}', dataRows.length)}</span>`;
  html += '</div>';

  html += '<table class="excel-table">';
  html += '<thead><tr>';
  for (let c = 0; c < headerRow.length; c++) {
    let sortClass = 'sortable';
    if (excelFilterState.sortCol === c) {
      sortClass += excelFilterState.sortDir === 'asc' ? ' sort-asc' : ' sort-desc';
    }
    html += `<th class="${sortClass}" data-col="${c}">${escapeHtml(String(headerRow[c]))}</th>`;
  }
  html += '</tr></thead><tbody>';

  if (displayRows.length === 0) {
    html += `<tr><td colspan="${headerRow.length}" style="text-align:center;padding:20px;color:var(--text-muted);">${t('data-no-results')}</td></tr>`;
  }

  for (const row of displayRows) {
    html += '<tr>';
    for (let c = 0; c < headerRow.length; c++) {
      const val = c < row.length ? String(row[c]) : '';
      html += `<td title="${escapeHtml(val)}">${escapeHtml(val)}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';

  if (dataRows.length > maxRows) {
    html += `<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.8rem;">${t('file-preview-showing').replace('{show}', maxRows).replace('{total}', dataRows.length)}</div>`;
  }

  wrap.innerHTML = html;

  // 绑定搜索事件
  const searchInput = document.getElementById('excelSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      excelFilterState.searchText = this.value;
      renderFilteredExcel(wrap, excelFilterState.headerRow, excelFilterState.allRows);
      // 重新聚焦搜索框
      const newInput = document.getElementById('excelSearchInput');
      if (newInput) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = newInput.value.length; }
    });
  }

  // 绑定表头排序事件
  wrap.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', function() {
      const col = parseInt(this.dataset.col);
      if (excelFilterState.sortCol === col) {
        excelFilterState.sortDir = excelFilterState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        excelFilterState.sortCol = col;
        excelFilterState.sortDir = 'asc';
      }
      renderFilteredExcel(wrap, excelFilterState.headerRow, excelFilterState.allRows);
    });
  });
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  modal.classList.remove('active');
  const body = document.getElementById('previewBody');
  const iframe = body.querySelector('iframe');
  if (iframe) {
    iframe.src = '';
  }
  // BUG-A08: 释放PDF blobUrl内存
  if (currentPdfBlobUrl) {
    try { URL.revokeObjectURL(currentPdfBlobUrl); } catch(e) {}
    currentPdfBlobUrl = null;
  }
  // 清除预览状态
  currentPreviewState = null;
  body.innerHTML = '';
}

// 点击遮罩关闭模态框
document.getElementById('previewModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closePreviewModal();
  }
});

// ESC键关闭模态框 / 键盘快捷键
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closePreviewModal();
  }

  // Excel预览中键盘左右箭头切换sheet
  if (currentPreviewState && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const tabs = document.querySelectorAll('.excel-sheet-tab');
    if (tabs.length === 0) return;
    const activeTab = document.querySelector('.excel-sheet-tab.active');
    if (!activeTab) return;
    let idx = Array.from(tabs).indexOf(activeTab);
    if (e.key === 'ArrowRight') idx = Math.min(idx + 1, tabs.length - 1);
    if (e.key === 'ArrowLeft') idx = Math.max(idx - 1, 0);
    if (idx !== Array.from(tabs).indexOf(activeTab)) {
      tabs[idx].click();
    }
    e.preventDefault();
  }

  // Ctrl+Enter 🔮 开始探秘
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    if (!isRunning) startFetching();
  }

  // Ctrl+. 停止
  if (e.ctrlKey && e.key === '.') {
    e.preventDefault();
    if (isRunning) stopFetching();
  }
});
