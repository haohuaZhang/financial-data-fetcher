// ==================== 步骤D: 玉简获取（增强链接查找） ====================

/**
 * 从已获取的HTML中提取PDF链接（不需要再次请求页面）
 */
function extractPdfLinkFromHtml(html, reportUrl) {
  // 优先级1: 正则搜索HTML源码中的.pdf链接（最可靠）
  const pdfUrlRegex = /(?:href|src)\s*=\s*["']([^"']*\.pdf[^"']*)["']/gi;
  let pdfMatch;
  while ((pdfMatch = pdfUrlRegex.exec(html)) !== null) {
    const pdfUrl = resolveUrl(pdfMatch[1], reportUrl);
    if (pdfUrl) {
      addLog(`${t('log-pdf-found')}: ${pdfUrl}`, 'success');
      return pdfUrl;
    }
  }

  // 优先级2: 用DOM解析查找
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = doc.querySelectorAll('a');

  // 文本包含"下载"的链接
  for (const a of links) {
    const text = a.textContent.trim();
    const href = a.getAttribute('href') || '';
    if (text.includes('下载') || text.includes('下载公告')) {
      const pdfUrl = resolveUrl(href, reportUrl);
      if (pdfUrl) {
        addLog(`${t('log-pdf-found')}: ${pdfUrl}`, 'success');
        return pdfUrl;
      }
    }
  }

  // href包含.pdf的链接
  for (const a of links) {
    const href = a.getAttribute('href') || '';
    if (href.includes('.pdf')) {
      const pdfUrl = resolveUrl(href, reportUrl);
      if (pdfUrl) {
        addLog(`${t('log-pdf-found')}: ${pdfUrl}`, 'success');
        return pdfUrl;
      }
    }
  }

  return null;
}

async function findPdfLink(reportUrl) {
  addLog(t('log-pdf-not-found') + '...', 'info');
  try {
    const html = await fetchViaProxy(reportUrl);
    const pdfLink = extractPdfLinkFromHtml(html, reportUrl);
    if (pdfLink) return pdfLink;
    addLog(t('log-pdf-no-link'), 'warn');
  } catch (e) {
    addLog(`${t('log-pdf-search-fail')}: ${e.message}`, 'error');
  }
  return null;
}

/**
 * 解析相对URL为绝对URL
 */
function resolveUrl(href, baseUrl) {
  if (!href) return null;
  let url = href;
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    try {
      const base = new URL(baseUrl);
      url = base.origin + url;
    } catch (e) {
      url = `https://vip.stock.finance.sina.com.cn${url}`;
    }
  } else if (!url.startsWith('http')) {
    try {
      url = new URL(url, baseUrl).href;
    } catch (e) {
      return null;
    }
  }
  return url;
}

/**
 * 通过代理下载PDF并存储到collectedFiles
 */
function isRevisedPdfTitle(text) {
  if (!text) return false;
  return /(修订版|修正版|修订稿|修正稿|修订后|修订|修正|更正|更新版|补充更正)/.test(String(text));
}

function getPdfRecordPriority(file) {
  const title = [file._sourceTitle, file.name, file.url].filter(Boolean).join(' ');
  return {
    revised: !!file._isRevised || isRevisedPdfTitle(title),
    hasBlob: file.type === 'pdf' && !!file.blob,
  };
}

function shouldReplacePdfRecord(existing, nextMeta) {
  const existingPriority = getPdfRecordPriority(existing);
  const nextPriority = {
    revised: !!nextMeta.isRevised,
    hasBlob: nextMeta.type === 'pdf',
  };

  if (nextPriority.revised !== existingPriority.revised) {
    return nextPriority.revised;
  }

  if (nextPriority.hasBlob !== existingPriority.hasBlob) {
    return nextPriority.hasBlob;
  }

  return false;
}

function findExistingPdfRecord(company, year, reportType) {
  return collectedFiles.find(file =>
    (file.type === 'pdf' || file.type === 'pdf-link') &&
    file._company === company &&
    String(file._year) === String(year) &&
    file._reportType === reportType
  ) || null;
}

function removeFileRecord(fileId) {
  const idx = collectedFiles.findIndex(file => file.id === fileId);
  if (idx >= 0) {
    collectedFiles.splice(idx, 1);
    updateFileCount();
  }
}

async function downloadPdfViaProxy(pdfUrl, filename, company, year, reportType, reportTitle = '') {
  addLog(`${t('log-pdf-download')}: ${filename}`, 'info');
  try {
    const existing = findExistingPdfRecord(company, year, reportType);
    const nextMeta = {
      type: 'pdf',
      isRevised: isRevisedPdfTitle([reportTitle, filename, pdfUrl].filter(Boolean).join(' ')),
    };

    if (existing && !shouldReplacePdfRecord(existing, nextMeta)) {
      addLog(`${t('log-pdf-success')}: ${filename}（已存在，跳过重复保存）`, 'info');
      return true;
    }
    const blob = await fetchBinaryViaProxy(pdfUrl);
    if (blob && await isValidPdfBlob(blob)) {
      if (existing) {
        removeFileRecord(existing.id);
      }
      const fileObj = {
        id: ++fileIdCounter,
        name: filename,
        type: 'pdf',
        category: 'pdfs',
        blob: blob,
        url: pdfUrl,
        size: blob.size,
        timestamp: new Date().toISOString(),
        _company: company,
        _year: year,
        _reportType: reportType,
        _sourceTitle: reportTitle,
        _isRevised: nextMeta.isRevised
      };
      collectedFiles.push(fileObj);
      updateFileCount();
      if (typeof refreshFinanceInsights === 'function') refreshFinanceInsights();
      addLog(`${t('log-pdf-success')}: ${filename} (${formatFileSize(blob.size)})`, 'success');
      return true;
    }
    addLog(t('log-pdf-too-small'), 'warn');
    return false;
  } catch (e) {
    addLog(`${t('log-pdf-error')}: ${e.message}`, 'error');
    return false;
  }
}

/**
 * 将PDF链接存入collectedFiles（标记为pdf-link类型，供手动下载）
 */
function savePdfLink(pdfUrl, filename, company, year, reportType, reportTitle = '') {
  const existing = findExistingPdfRecord(company, year, reportType);
  const nextMeta = {
    type: 'pdf-link',
    isRevised: isRevisedPdfTitle([reportTitle, filename, pdfUrl].filter(Boolean).join(' ')),
  };

  if (existing && !shouldReplacePdfRecord(existing, nextMeta)) {
    addLog(`${t('log-pdf-link-saved')}: ${filename}（已存在，跳过重复保存）`, 'info');
    return;
  }

  if (existing) {
    removeFileRecord(existing.id);
  }
  const fileObj = {
    id: ++fileIdCounter,
    name: filename,
    type: 'pdf-link',
    category: 'pdfs',
    blob: null,
    url: pdfUrl,
    size: 0,
    timestamp: new Date().toISOString(),
    _pdfInfo: { company, year, reportType },
    _company: company,
    _year: year,
    _reportType: reportType,
    _sourceTitle: reportTitle,
    _isRevised: nextMeta.isRevised
  };
  collectedFiles.push(fileObj);
  updateFileCount();
  if (typeof refreshFinanceInsights === 'function') refreshFinanceInsights();
  addLog(`${t('log-pdf-link-saved')}: ${filename}`, 'info');
}
