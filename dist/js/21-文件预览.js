// ==================== 文件预览 ====================

async function previewFile(fileId) {
  const file = collectedFiles.find(f => f.id === fileId);
  if (!file) return;

  const modal = document.getElementById('previewModal');
  const title = document.getElementById('previewTitle');
  const body = document.getElementById('previewBody');
  if (!modal || !title || !body) return;

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
      html += '</div>';
      html += `<div class="excel-table-wrap" id="excelTableWrap"></div>`;
      body.innerHTML = html;

      // 存储预览状态用于键盘切换sheet
      excelFilterState = { searchText: '', collapsedSections: {}, targetTables: [...new Set((file._tableNames || []).map(String).filter(Boolean))] };
      currentPreviewState = { fileId, sheetNames: workbook.SheetNames, targetTables: excelFilterState.targetTables };
      renderExcelSheet(workbook.SheetNames[0], fileId);
    } catch (e) {
      body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--error);">${t('file-preview-fail')}: ${escapeHtml(e.message)}</div>`;
    }
  } else if (file.type === 'pdf') {
    const blobUrl = currentPdfBlobUrl && currentPreviewState && currentPreviewState.fileId === fileId ? currentPdfBlobUrl : URL.createObjectURL(file.blob);
    currentPdfBlobUrl = blobUrl;
    currentPreviewState = { fileId, type: 'pdf' };
    body.innerHTML = `<div class="pdf-preview-shell">
      <div class="pdf-preview-toolbar">
        <div>
          <div class="pdf-preview-title">PDF 预览</div>
          <div class="pdf-preview-meta">${escapeHtml(file.name)} · ${formatFileSize(file.size)}</div>
        </div>
        <div class="pdf-preview-actions">
          <a class="btn-file-action primary-action" href="${blobUrl}" download="${escapeHtml(file.name)}">下载 PDF</a>
        </div>
      </div>
      <iframe class="pdf-preview-frame" src="${blobUrl}" title="${escapeHtml(file.name)}"></iframe>
    </div>`;
  } else if (file.type === 'pdf-link') {
    currentPreviewState = { fileId, type: 'pdf-link' };
    const renderInlineUrl = (note) => {
      body.innerHTML = `<div class="pdf-preview-shell">
        <div class="pdf-preview-toolbar">
          <div>
            <div class="pdf-preview-title">PDF 链接预览</div>
            <div class="pdf-preview-meta">${escapeHtml(file.url)}</div>
          </div>
          <div class="pdf-preview-actions">
            <button class="btn-file-action" id="copyPdfLinkBtn">复制链接</button>
          </div>
        </div>
        <div class="pdf-preview-fallback">${escapeHtml(note)}</div>
        <iframe class="pdf-preview-frame" src="${escapeHtml(file.url)}#view=FitH" title="${escapeHtml(file.name)}"></iframe>
      </div>`;
      const copyBtn = document.getElementById('copyPdfLinkBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(file.url);
            copyBtn.textContent = '已复制';
            setTimeout(() => { copyBtn.textContent = '复制链接'; }, 1500);
          } catch (err) {
            copyBtn.textContent = '复制失败';
            setTimeout(() => { copyBtn.textContent = '复制链接'; }, 1500);
          }
        });
      }
    };
    const tryRender = async () => {
      body.innerHTML = `<div class="pdf-preview-shell"><div class="pdf-preview-toolbar"><div><div class="pdf-preview-title">PDF 链接预览</div><div class="pdf-preview-meta">正在尝试直接预览...</div></div></div><div class="pdf-preview-loading"><span class="spinner"></span> ${t('file-preview-loading')}</div></div>`;
      try {
        const blob = await fetchBinaryViaProxy(file.url);
        if (!await isValidPdfBlob(blob)) throw new Error('不是有效PDF');
        const blobUrl = URL.createObjectURL(blob);
        currentPdfBlobUrl = blobUrl;
        body.innerHTML = `<div class="pdf-preview-shell">
          <div class="pdf-preview-toolbar">
            <div>
              <div class="pdf-preview-title">PDF 链接预览</div>
              <div class="pdf-preview-meta">${escapeHtml(file.url)}</div>
            </div>
            <div class="pdf-preview-actions">
              <a class="btn-file-action primary-action" href="${blobUrl}" download="${escapeHtml(file.name)}">下载 PDF</a>
            </div>
          </div>
          <iframe class="pdf-preview-frame" src="${blobUrl}" title="${escapeHtml(file.name)}"></iframe>
        </div>`;
      } catch (e) {
        renderInlineUrl('当前链接已在页面内预览，若无法显示请直接使用下方链接。');
      }
    };
    tryRender();
  }
}

function switchExcelSheet(tabEl, sheetName, fileId) {
  tabEl.parentElement.querySelectorAll('.excel-sheet-tab').forEach(el => el.classList.remove('active'));
  tabEl.classList.add('active');
  excelFilterState.collapsedSections = {};
  renderExcelSheet(sheetName, fileId);
}

// BUG-A05: 使用事件委托处理Excel sheet标签点击（避免内联onclick特殊字符问题）
document.addEventListener('click', function(e) {
  const tab = e.target.closest('.excel-sheet-tab');
  if (!tab) return;
  const tabsContainer = tab.closest('.excel-sheet-tabs');
  if (!tabsContainer) return;

  const fileId = parseInt(tabsContainer.dataset.fileId);
  const sheetName = tab.dataset.sheetName;
  if (sheetName !== undefined && !isNaN(fileId)) {
    switchExcelSheet(tab, sheetName, fileId);
  }
});

// 当前Excel预览的筛选/折叠状态
let excelFilterState = { searchText: '', collapsedSections: {}, targetTables: [] };

function countNonEmptyCells(row) {
  return (row || []).filter(cell => String(cell ?? '').trim() !== '').length;
}

function splitExcelSections(rows, sheetName, targetTables) {
  const titles = (targetTables || []).map(s => String(s).trim()).filter(Boolean);
  const titleSet = new Set(titles);
  if (titles.length === 0) {
    const bodyRows = rows.filter(row => countNonEmptyCells(row) > 0);
    return bodyRows.length ? [{ title: sheetName || t('file-preview-empty-sheet'), rows: bodyRows }] : [];
  }

  const sections = [];
  let current = null;
  let matchedTitles = new Set();

  const isTitleRow = row => {
    if (!row || countNonEmptyCells(row) !== 1) return null;
    const firstCell = String(row[0] ?? '').trim();
    return titleSet.has(firstCell) ? firstCell : null;
  };

  for (const rawRow of rows) {
    const row = rawRow || [];
    if (countNonEmptyCells(row) === 0) continue;

    const title = isTitleRow(row);
    if (title) {
      if (current && current.title === title) {
        continue;
      }
      if (current && current.title !== title) {
        sections.push(current);
        current = null;
      }
      if (!matchedTitles.has(title)) {
        current = { title, rows: [] };
        matchedTitles.add(title);
      }
      continue;
    }

    if (current) {
      current.rows.push(row);
    }
  }

  if (current) sections.push(current);
  return sections.filter(section => section.rows.length > 0);
}

function renderExcelSheet(sheetName, fileId) {
  const file = collectedFiles.find(f => f.id === fileId);
  if (!file) return;

  const wrap = document.getElementById('excelTableWrap');
  if (!wrap) return;

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
      const sections = splitExcelSections(rows, sheetName, currentPreviewState?.targetTables || excelFilterState.targetTables);
      currentPreviewState = { ...(currentPreviewState || {}), fileId, sheetName, sections };
      renderFilteredExcel(wrap, sections);
    } catch (e) {
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--error);">${t('file-preview-render-fail')}: ${escapeHtml(e.message)}</div>`;
    }
  };

  readAndRender();
}

function renderFilteredExcel(wrap, sections) {
  let html = '<div class="data-filter-bar">';
  html += `<input type="text" id="excelSearchInput" placeholder="${t('data-search-placeholder')}" value="${escapeHtml(excelFilterState.searchText)}">`;
  const visibleRows = sections.reduce((sum, sec) => {
    const sectionRows = getFilteredExcelSectionRows(sec);
    return sum + Math.max(sectionRows.length - 1, 0);
  }, 0);
  const totalRows = sections.reduce((sum, sec) => sum + Math.max(sec.rows.length - 1, 0), 0);
  html += `<span class="data-filter-info">${t('data-showing').replace('{n}', visibleRows).replace('{total}', totalRows)}</span>`;
  html += '</div>';

  if (sections.length === 0) {
    html += `<div style="padding:40px;text-align:center;color:var(--text-muted);">${t('data-no-results')}</div>`;
  } else {
    sections.forEach((section, idx) => {
      const filteredRows = getFilteredExcelSectionRows(section);
      const isCollapsed = !!excelFilterState.collapsedSections[idx];
      const title = escapeHtml(section.title || `Sheet ${idx + 1}`);
      const headerRow = filteredRows[0] || [];
      const bodyRows = filteredRows.slice(1);
      html += `<div class="excel-section" data-section-idx="${idx}">
        <div class="excel-section-head">
          <button class="excel-section-toggle" type="button" data-section-idx="${idx}" aria-label="切换折叠">${isCollapsed ? '▸' : '▾'}</button>
          <div class="excel-section-title">${title}</div>
          <div class="excel-section-meta">${Math.max(filteredRows.length - 1, 0)} 行</div>
        </div>
        <div class="excel-section-body" style="${isCollapsed ? 'display:none;' : ''}">`;
      if (filteredRows.length === 0) {
        html += `<div class="excel-section-empty">${t('data-no-results')}</div>`;
      } else {
        html += '<table class="excel-table">';
        html += '<thead><tr>';
        headerRow.forEach((cell, c) => {
          html += `<th>${escapeHtml(String(cell || ''))}</th>`;
        });
        html += '</tr></thead><tbody>';
        if (bodyRows.length === 0) {
          html += `<tr><td colspan="${Math.max(headerRow.length, 1)}" style="text-align:center;padding:20px;color:var(--text-muted);">${t('data-no-results')}</td></tr>`;
        } else {
          bodyRows.forEach(row => {
            html += '<tr>';
            for (let c = 0; c < headerRow.length; c++) {
              const val = c < row.length ? String(row[c]) : '';
              html += `<td title="${escapeHtml(val)}">${escapeHtml(val)}</td>`;
            }
            html += '</tr>';
          });
        }
        html += '</tbody></table>';
      }
      html += '</div></div>';
    });
  }

  wrap.innerHTML = html;

  // 绑定搜索事件
  const searchInput = document.getElementById('excelSearchInput');
  if (searchInput) {
    if (excelFilterState.isComposing === undefined) excelFilterState.isComposing = false;
    searchInput.addEventListener('compositionstart', function() {
      excelFilterState.isComposing = true;
    });
    searchInput.addEventListener('compositionend', function() {
      excelFilterState.isComposing = false;
      excelFilterState.searchText = this.value;
      renderFilteredExcel(document.getElementById('excelTableWrap'), currentPreviewState?.sections || sections || []);
      const newInput = document.getElementById('excelSearchInput');
      if (newInput) {
        newInput.focus();
        newInput.selectionStart = newInput.selectionEnd = newInput.value.length;
      }
    });
    searchInput.addEventListener('input', function() {
      excelFilterState.searchText = this.value;
      if (excelFilterState.isComposing || this.isComposing) return;
      renderFilteredExcel(document.getElementById('excelTableWrap'), currentPreviewState?.sections || sections || []);
      // 重新聚焦搜索框
      const newInput = document.getElementById('excelSearchInput');
      if (newInput) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = newInput.value.length; }
    });
  }

  wrap.querySelectorAll('.excel-section-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.dataset.sectionIdx;
      excelFilterState.collapsedSections[idx] = !excelFilterState.collapsedSections[idx];
      renderFilteredExcel(document.getElementById('excelTableWrap'), currentPreviewState?.sections || sections || []);
    });
  });
}

function getFilteredExcelSectionRows(section) {
  const query = excelFilterState.searchText.trim().toLowerCase();
  if (!query) return section.rows;
  const titleMatch = String(section.title || '').toLowerCase().includes(query);
  if (titleMatch) return section.rows;
  const header = section.rows[0] || [];
  const filteredBody = section.rows.slice(1).filter(row => row.some(cell => String(cell).toLowerCase().includes(query)));
  if (filteredBody.length === 0) return [];
  return [header, ...filteredBody];
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  modal.classList.remove('active');
  const body = document.getElementById('previewBody');
  const iframe = body.querySelector('iframe');
  if (iframe) iframe.src = '';
  if (currentPdfBlobUrl) {
    try { URL.revokeObjectURL(currentPdfBlobUrl); } catch(e) {}
    currentPdfBlobUrl = null;
  }
  currentPreviewState = null;
  body.innerHTML = '';
}

// 点击遮罩关闭模态框
const previewModalEl = document.getElementById('previewModal');
if (previewModalEl) {
  previewModalEl.addEventListener('click', function(e) {
    if (e.target === this) {
      closePreviewModal();
    }
  });
}

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
