// ==================== 🎒 储物袋面板 ====================

function updateFileCount() {
  document.getElementById('fileCount').textContent = collectedFiles.length;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * 渲染文件列表（支持pdf-link类型）
 */
function renderFileList() {
  const container = document.getElementById('fileListContainer');

  if (collectedFiles.length === 0) {
    // BUG-A07: 重新创建fileEmpty元素，避免被innerHTML覆盖后丢失
    container.innerHTML = '<div class="file-empty" id="fileEmpty"><div class="file-empty-icon">&#x1F4C2;</div><div data-i18n="file-empty-title">' + t('file-empty-title') + '</div><div style="font-size:0.75rem;" data-i18n="file-empty-hint">' + t('file-empty-hint') + '</div></div>';
    return;
  }

  // 按类型分组
  const excelFiles = collectedFiles.filter(f => f.type === 'excel');
  const pdfFiles = collectedFiles.filter(f => f.type === 'pdf');
  const pdfLinkFiles = collectedFiles.filter(f => f.type === 'pdf-link');

  let html = '';

  if (excelFiles.length > 0) {
    html += `<div class="file-group-title"><span class="group-icon">&#x1F4CA;</span> ${t('file-group-excel')} (${excelFiles.length})</div>`;
    for (const file of excelFiles) {
      html += renderFileItem(file);
    }
  }

  if (pdfFiles.length > 0) {
    html += `<div class="file-group-title"><span class="group-icon">&#x1F4C4;</span> ${t('file-group-pdf')} (${pdfFiles.length})</div>`;
    for (const file of pdfFiles) {
      html += renderFileItem(file);
    }
  }

  if (pdfLinkFiles.length > 0) {
    html += `<div class="file-group-title"><span class="group-icon">&#x1F517;</span> ${t('file-group-pdf-link')} (${pdfLinkFiles.length})</div>`;
    for (const file of pdfLinkFiles) {
      html += renderFileItem(file);
    }
  }

  container.innerHTML = html;

  // 绑定复选框事件
  container.querySelectorAll('.file-item-checkbox').forEach(cb => {
    cb.addEventListener('click', () => {
      const fileId = parseInt(cb.dataset.fileId);
      const file = collectedFiles.find(f => f.id === fileId);
      if (file) {
        file._selected = !file._selected;
        cb.classList.toggle('checked', file._selected);
        updateDownloadButton();
      }
    });
  });

  // 绑定文件名点击事件
  container.querySelectorAll('.file-item-name.clickable').forEach(nameEl => {
    nameEl.addEventListener('click', () => {
      const fileId = parseInt(nameEl.dataset.fileId);
      const file = collectedFiles.find(f => f.id === fileId);
      if (!file) return;

      if (file.type === 'pdf-link') {
        // PDF链接类型：在新标签页打开
        window.open(file.url, '_blank');
      } else {
        previewFile(fileId);
      }
    });
  });
}

/**
 * 渲染单个文件项
 */
function renderFileItem(file) {
  let iconClass, iconText, metaText;

  if (file.type === 'excel') {
    iconClass = 'excel';
    iconText = 'XLS';
    metaText = `${formatFileSize(file.size)} | ${formatTimestamp(file.timestamp)}`;
  } else if (file.type === 'pdf') {
    iconClass = 'pdf';
    iconText = 'PDF';
    metaText = `${formatFileSize(file.size)} | ${formatTimestamp(file.timestamp)}`;
  } else if (file.type === 'pdf-link') {
    iconClass = 'pdf-link';
    iconText = 'LNK';
    metaText = `${t('file-meta-manual')} | ${formatTimestamp(file.timestamp)}`;
  }

  const checked = file._selected ? 'checked' : '';
  const nameTitle = file.type === 'pdf-link'
    ? `点击在新标签页打开: ${escapeHtml(file.url)}`
    : escapeHtml(file.name);

  return `
    <div class="file-item">
      <div class="file-item-checkbox ${checked}" data-file-id="${file.id}"></div>
      <div class="file-item-icon ${iconClass}">${iconText}</div>
      <div class="file-item-info">
        <div class="file-item-name clickable" data-file-id="${file.id}" title="${nameTitle}">${escapeHtml(file.name)}</div>
        <div class="file-item-meta">${metaText}</div>
      </div>
    </div>
  `;
}

function selectAllFiles() {
  collectedFiles.forEach(f => f._selected = true);
  renderFileList();
  updateDownloadButton();
}

function deselectAllFiles() {
  collectedFiles.forEach(f => f._selected = false);
  renderFileList();
  updateDownloadButton();
}

function updateDownloadButton() {
  const selectedCount = collectedFiles.filter(f => f._selected).length;
  const btn = document.getElementById('btnDownloadZip');
  btn.disabled = selectedCount === 0;
  btn.textContent = selectedCount > 0 ? `📦 ${t('btn-download-zip').replace(' (ZIP)','')} (${selectedCount})` : t('btn-download-zip');
}

/**
 * 下载选中文件为ZIP包
 * Excel -> reports/, PDF -> pdfs/, PDF链接 -> pdf_links.txt
 */
async function downloadSelectedZip() {
  const selectedFiles = collectedFiles.filter(f => f._selected);
  if (selectedFiles.length === 0) return;

  addLog(`${t('log-zip-packing')} ${selectedFiles.length} ${t('log-zip-items')}`, 'info');

  try {
    const zip = new JSZip();
    const pdfLinks = [];

    for (const file of selectedFiles) {
      const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_');

      if (file.type === 'pdf-link') {
        // PDF链接类型：收集到pdf_links.txt
        pdfLinks.push(`${file.name}: ${file.url}`);
      } else if (file.blob) {
        // Excel或PDF有实际blob数据
        const folder = file.category === 'pdfs' ? 'pdfs/' : 'reports/';
        zip.file(folder + safeName, file.blob);
      }
    }

    // 如果有PDF链接，生成pdf_links.txt
    if (pdfLinks.length > 0) {
      const linkContent = `${t('zip-pdf-links-header')}\n\n` +
        pdfLinks.join('\n') +
        `\n\n生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
      zip.file('pdf_links.txt', linkContent);
      addLog(`${t('log-zip-pdf-links')} ${pdfLinks.length} ${t('log-zip-pdf-links-suffix')}`, 'info');
    }

    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipName = `${t('zip-filename')}_${new Date().toISOString().slice(0, 10)}.zip`;
    saveAs(content, zipName);
    addLog(`${t('log-zip-done')}: ${zipName} (${formatFileSize(content.size)})`, 'success');
  } catch (e) {
    addLog(`${t('log-zip-fail')}: ${e.message}`, 'error');
  }
}
