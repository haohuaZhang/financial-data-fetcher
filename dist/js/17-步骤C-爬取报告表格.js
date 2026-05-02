// ==================== 步骤C: 爬取报告表格 ====================
async function fetchReportTables(reportUrl, targetTables, nameLengthLimit, needPdf = false) {
  addLog(`${t('log-fetch-tables')}: ${reportUrl.substring(0, 80)}...`, 'info');
  const html = await fetchViaProxy(reportUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const allTables = {};

  for (const tableName of targetTables) {
    addLog(`${t('log-find-table')}: "${tableName}"`, 'info');

    // 查找所有匹配的表格（可能跨页有多个）
    let foundTables = findTablesInDoc(doc, tableName, nameLengthLimit);

    // 如果没找到，尝试去掉"合并"
    if (foundTables.length === 0 && tableName.includes('合并')) {
      const shortName = tableName.replace('合并', '');
      addLog(`${t('log-remove-merge')}: "${shortName}"`, 'warn');
      foundTables = findTablesInDoc(doc, shortName, nameLengthLimit);
    }

    if (tableName === '合并财务报表项目注释' && typeof isVipMember === 'function' && isVipMember()) {
      addLog(`开始查找"合并财务报表项目注释"的相关子表格...`, 'info');
      const subTables = findMergeNotesSubTables(doc, tableName, nameLengthLimit);
      if (subTables.length > 0) {
        allTables[tableName] = subTables;
        addLog(`找到 ${subTables.length} 个相关子表格`, 'success');
      } else {
        allTables[tableName] = [];
        addLog(`${t('log-table-not-found')} "${tableName}"`, 'error');
      }
    } else if (foundTables.length > 0) {
      // 普通表格：合并所有找到的表格数据（处理跨页情况）
      let mergedRows = [];
      for (const tableRows of foundTables) {
        if (mergedRows.length === 0) {
          mergedRows = tableRows;
        } else {
          // 跨页合并：跳过重复的表头行
          if (tableRows.length > 1) {
            const firstDataRow = tableRows[0];
            const lastMergedRow = mergedRows[mergedRows.length - 1];
            if (isSimilarRow(firstDataRow, lastMergedRow)) {
              mergedRows = mergedRows.concat(tableRows.slice(1));
            } else {
              mergedRows = mergedRows.concat(tableRows);
            }
          }
        }
      }
      allTables[tableName] = mergedRows;
      addLog(`${t('log-table-found')} "${tableName}"，${t('log-table-rows')} ${mergedRows.length} ${t('log-table-from')} ${foundTables.length} ${t('log-table-fragments')}`, 'success');
    } else {
      addLog(`${t('log-table-not-found')} "${tableName}"`, 'error');
      allTables[tableName] = [];
    }
  }

  // 仅在需要PDF时提取链接，避免无关请求和日志
  if (needPdf) {
    const pdfLink = extractPdfLinkFromHtml(html, reportUrl);
    if (pdfLink) {
      allTables['__pdfLink__'] = pdfLink;
    }
  }

  return allTables;
}

/**
 * 判断两行是否相似（用于跨页合并时跳过重复表头）
 */
function isSimilarRow(row1, row2) {
  if (!row1 || !row2) return false;
  if (row1.length === 0) return false;
  if (row1.length !== row2.length) return false;
  let matchCount = 0;
  for (let i = 0; i < row1.length; i++) {
    if (row1[i] && row2[i] && row1[i].trim() === row2[i].trim()) {
      matchCount++;
    }
  }
  return matchCount / row1.length > 0.7;
}

/**
 * 在文档中查找所有匹配的表格（增强版，增加详细调试日志）
 */
function findTablesInDoc(doc, tableName, nameLengthLimit) {
  const results = [];
  const allP = doc.querySelectorAll('p');

  addLog(`[debug] ${t('log-debug-p-tags')} ${allP.length} ${t('log-debug-p-suffix')}`, 'debug');

  // 统计包含目标关键词的p标签
  let matchCount = 0;
  for (const p of allP) {
    const text = p.textContent.trim();
    if (text.length <= nameLengthLimit && text.includes(tableName)) {
      matchCount++;
    }
  }
  addLog(`[debug] ${matchCount} ${t('log-debug-match-p')} "${tableName}"`, 'debug');

  for (let i = 0; i < allP.length; i++) {
    const p = allP[i];
    const text = p.textContent.trim();
    if (text.length > nameLengthLimit) continue;
    if (!text.includes(tableName)) continue;

    addLog(`[debug] ${t('log-debug-p-match')} #${i}: "${text.substring(0, 80)}"`, 'debug');

    // 策略a: 遍历后续兄弟元素，查找table（最多往下找20个兄弟）
    let sibling = p.nextElementSibling;
    let siblingCount = 0;
    while (sibling && siblingCount < 20) {
      const table = findTableInElement(sibling);
      if (table) {
        const parsed = parseTable(table);
        if (isValidTable(parsed)) {
          results.push(parsed);
          addLog(`[策略a] 在兄弟元素 <${sibling.tagName.toLowerCase()}> 中找到表格 (${parsed.length}行)`, 'debug');
          // 继续查找后续连续的div.table-wrap（跨页合并）
          let nextSibling = sibling.nextElementSibling;
          let wrapCount = 0;
          while (nextSibling && wrapCount < 10) {
            // 跳过 <p>/</p> 段落（巨潮报告跨页分隔符）
            if (nextSibling.tagName === 'P' && nextSibling.textContent.trim() === '/') {
              nextSibling = nextSibling.nextElementSibling;
              continue;
            }
            // 跳过空的 <p></p> 段落
            if (nextSibling.tagName === 'P' && nextSibling.textContent.trim() === '') {
              nextSibling = nextSibling.nextElementSibling;
              continue;
            }
            if (nextSibling.classList && nextSibling.classList.contains('table-wrap')) {
              const innerTable = nextSibling.querySelector('table');
              if (innerTable) {
                const parsed2 = parseTable(innerTable);
                if (isValidTable(parsed2)) {
                  results.push(parsed2);
                  addLog(`[策略a-跨页] 找到连续表格片段`, 'debug');
                }
              }
            } else if (nextSibling.tagName === 'TABLE') {
              const parsed2 = parseTable(nextSibling);
              if (isValidTable(parsed2)) {
                results.push(parsed2);
                addLog(`[策略a-跨页] 找到连续table元素`, 'debug');
              }
            } else {
              break;
            }
            nextSibling = nextSibling.nextElementSibling;
            wrapCount++;
          }
          break;
        }
      }
      sibling = sibling.nextElementSibling;
      siblingCount++;
    }

    if (results.length > 0) continue;

    // 策略b: 在p标签的父元素中，从p之后的所有子元素中递归查找table
    const parent = p.parentElement;
    if (parent) {
      const children = Array.from(parent.children);
      const idx = children.indexOf(p);
      for (let j = idx + 1; j < children.length && j < idx + 20; j++) {
        const table = findTableInElement(children[j]);
        if (table) {
          const parsed = parseTable(table);
          if (isValidTable(parsed)) {
            results.push(parsed);
            addLog(`[策略b] 在父元素子节点中找到表格`, 'debug');
            break;
          }
        }
      }
    }

    if (results.length > 0) continue;

    // 策略c: 在p标签的祖先元素中向上查找，然后从对应位置往后找
    let ancestor = parent ? parent.parentElement : null;
    let ancestorDepth = 0;
    while (ancestor && ancestorDepth < 5) {
      const ancestorChildren = Array.from(ancestor.children);
      const containerIdx = ancestorChildren.findIndex(child => {
        return child === parent || child.contains(p);
      });
      if (containerIdx >= 0) {
        for (let k = containerIdx + 1; k < ancestorChildren.length && k < containerIdx + 20; k++) {
          const table = findTableInElement(ancestorChildren[k]);
          if (table) {
            const parsed = parseTable(table);
            if (isValidTable(parsed)) {
              results.push(parsed);
              addLog(`[策略c] 在祖先元素子节点中找到表格`, 'debug');
              break;
            }
          }
        }
        if (results.length > 0) break;
      }
      ancestor = ancestor.parentElement;
      ancestorDepth++;
    }

    if (results.length > 0) continue;

    // 策略d: 在整个文档中用compareDocumentPosition找p之后的第一个table
    const allTables = doc.querySelectorAll('table');
    for (const table of allTables) {
      const position = p.compareDocumentPosition(table);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        const parsed = parseTable(table);
        if (isValidTable(parsed)) {
          results.push(parsed);
          addLog(`[策略d] 在文档后续位置找到表格`, 'debug');
          break;
        }
      }
    }

    if (results.length > 0) continue;

    // 策略e: 全文搜索兜底 - 用正则在HTML源码中搜索包含目标关键词的表格
    addLog(t('log-strategy-e'), 'warn');
    const htmlSource = doc.documentElement.outerHTML;
    const tableRegex = new RegExp(`(?:<p[^>]*>[^<]*${escapeRegex(tableName)}[^<]*</p>\\s*)(<table[\\s\\S]*?</table>)`, 'gi');
    let regexMatch;
    while ((regexMatch = tableRegex.exec(htmlSource)) !== null) {
      try {
        const tableHtml = regexMatch[1];
        const tempDoc = new DOMParser().parseFromString(`<div>${tableHtml}</div>`, 'text/html');
        const tableEl = tempDoc.querySelector('table');
        if (tableEl) {
          const parsed = parseTable(tableEl);
          if (isValidTable(parsed)) {
            results.push(parsed);
            addLog(`[策略e] 全文正则搜索找到表格`, 'debug');
            break;
          }
        }
      } catch (e) {
        // 正则解析失败，继续
      }
    }
  }

  return results;
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 在一个元素中查找table
 */
function findTableInElement(el) {
  if (!el) return null;
  if (el.tagName === 'TABLE') return el;
  const tables = el.querySelectorAll('table');
  if (tables.length > 0) return tables[0];
  return null;
}

/**
 * 检查解析出的表格是否有效（降低门槛：至少1行2列）
 */
function isValidTable(rows) {
  if (!rows || rows.length < 1) return false;
  let maxCols = 0;
  for (const row of rows) {
    if (row.length > maxCols) maxCols = row.length;
  }
  return maxCols >= 2;
}

/**
 * 解析HTML table元素为二维数组（按 rowspan/colspan 展开网格）
 */
function parseTable(tableEl) {
  const grid = [];
  const trs = tableEl.querySelectorAll('tr');
  for (let r = 0; r < trs.length; r++) {
    if (!grid[r]) grid[r] = [];
    let c = 0;
    const tds = trs[r].querySelectorAll('td, th');
    for (const td of tds) {
      while (grid[r][c] !== undefined) c++;

      const text = td.textContent.trim().replace(/\s+/g, ' ');
      const colspan = Math.max(1, parseInt(td.getAttribute('colspan'), 10) || 1);
      const rowspan = Math.max(1, parseInt(td.getAttribute('rowspan'), 10) || 1);

      for (let dr = 0; dr < rowspan; dr++) {
        const rr = r + dr;
        while (grid.length <= rr) grid.push([]);
        for (let dc = 0; dc < colspan; dc++) {
          const cc = c + dc;
          if (dr === 0 && dc === 0) grid[rr][cc] = text;
          else grid[rr][cc] = '';
        }
      }
      c += colspan;
    }
  }

  let maxCols = 0;
  for (let ri = 0; ri < grid.length; ri++) {
    const row = grid[ri];
    maxCols = Math.max(maxCols, row.length);
    for (let ci = 0; ci < row.length; ci++) {
      if (row[ci] !== undefined) maxCols = Math.max(maxCols, ci + 1);
    }
  }

  return grid.map(row => {
    const out = [];
    for (let i = 0; i < maxCols; i++) {
      const v = row[i];
      out.push(v === undefined ? '' : String(v));
    }
    return out;
  });
}

const chineseNumbersArr = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const mergeNotesDigitTitleRe = /^\s*([0-9０-９]{1,4})[、:：．.]/;
const mergeNotesParenNumDotRe = /^\s*[（(]([0-9０-９]{1,4})[）\)][.．。:：]\s*/;

function collectPrevSiblingPsBeforeWrap(wrap, maxP) {
  const ps = [];
  let cur = wrap.previousElementSibling;
  while (cur && ps.length < maxP) {
    if (cur.tagName === 'P') ps.unshift(cur);
    cur = cur.previousElementSibling;
  }
  return ps;
}

function findPreviousPElement(node) {
  let n = node && node.previousElementSibling;
  while (n && n.tagName !== 'P') n = n.previousElementSibling;
  return n;
}

function analyzeMergeNotesPrevPs(prevPs) {
  let digitP = null;
  for (let i = prevPs.length - 1; i >= 0; i--) {
    const t = prevPs[i].textContent.trim();
    if (mergeNotesDigitTitleRe.test(t)) {
      digitP = prevPs[i];
      break;
    }
  }
  let parenP = null;
  for (let i = prevPs.length - 1; i >= 0; i--) {
    const t = prevPs[i].textContent.trim();
    if (mergeNotesParenNumDotRe.test(t)) {
      parenP = prevPs[i];
      break;
    }
  }
  let shiyongSubtitleP = null;
  for (let i = 0; i < prevPs.length; i++) {
    if (prevPs[i].textContent.indexOf('适用') < 0) continue;
    const prevP = findPreviousPElement(prevPs[i]);
    if (!prevP) continue;
    const prevTx = prevP.textContent.trim();
    if (!prevTx) continue;
    if (mergeNotesDigitTitleRe.test(prevTx)) continue;
    shiyongSubtitleP = prevP;
    break;
  }
  let danweiSubtitleP = null;
  for (let i = prevPs.length - 1; i >= 0; i--) {
    if (prevPs[i].textContent.indexOf('单位：元') < 0) continue;
    let anchor = findPreviousPElement(prevPs[i]);
    while (anchor) {
      const tx = anchor.textContent.trim();
      if (!tx) {
        anchor = findPreviousPElement(anchor);
        continue;
      }
      if (mergeNotesDigitTitleRe.test(tx)) break;
      if (tx.indexOf('适用') >= 0) {
        anchor = findPreviousPElement(anchor);
        continue;
      }
      danweiSubtitleP = anchor;
      break;
    }
    break;
  }
  const hasShiyong = shiyongSubtitleP !== null;
  const hasDanwei = danweiSubtitleP !== null;
  const conflict = !!(digitP && (parenP || hasShiyong || hasDanwei));
  return { digitP, parenP, shiyongSubtitleP, danweiSubtitleP, conflict };
}

function pickTableSubtitleP(meta) {
  if (meta.conflict) return meta.parenP || meta.shiyongSubtitleP || meta.danweiSubtitleP;
  return meta.digitP || meta.parenP || meta.shiyongSubtitleP || meta.danweiSubtitleP;
}

function buildMergeNotesTitleWithInterveningPs(subtitleP, wrap) {
  const core = subtitleP.textContent.trim();
  const chunks = [];
  let n = subtitleP.nextElementSibling;
  while (n && n !== wrap) {
    if (n.tagName === 'P') {
      const tx = n.textContent.trim();
      if (tx) chunks.push(tx);
    }
    n = n.nextElementSibling;
  }
  const mid = chunks.join('');
  return mid ? core + '（' + mid + '）' : core;
}

function mergeTableFragmentsToRows(fragments) {
  let mergedRows = [];
  for (const tableRows of fragments) {
    if (mergedRows.length === 0) {
      mergedRows = tableRows;
    } else if (tableRows.length > 1) {
      const firstDataRow = tableRows[0];
      const lastMergedRow = mergedRows[mergedRows.length - 1];
      if (isSimilarRow(firstDataRow, lastMergedRow)) {
        mergedRows = mergedRows.concat(tableRows.slice(1));
      } else {
        mergedRows = mergedRows.concat(tableRows);
      }
    } else {
      mergedRows = mergedRows.concat(tableRows);
    }
  }
  return mergedRows;
}

function findMergeNotesSubTables(doc, tableName, nameLengthLimit) {
  const results = [];
  const allP = doc.querySelectorAll('p');
  let startElement = null;

  for (const p of allP) {
    const text = p.textContent.trim();
    if (text.length <= nameLengthLimit && text.includes(tableName)) {
      startElement = p;
      break;
    }
  }
  if (!startElement && tableName.includes('合并')) {
    const shortName = tableName.replace('合并', '');
    for (const p of allP) {
      const text = p.textContent.trim();
      if (text.length <= nameLengthLimit && text.includes(shortName)) {
        startElement = p;
        break;
      }
    }
  }
  if (!startElement) {
    addLog(`[子表格查找] 未找到起始标题`, 'warn');
    return results;
  }

  const head = startElement.textContent.trim().slice(0, 48);
  const sectionHeadRe = /^[（(]?([一二三四五六七八九十]+)[）)]?[、.．]?/;
  const headMatch = sectionHeadRe.exec(head);
  let stopNumChar = null;
  if (headMatch) {
    const idx = chineseNumbersArr.indexOf(headMatch[1]);
    if (idx >= 0 && idx + 1 < chineseNumbersArr.length) stopNumChar = chineseNumbersArr[idx + 1];
  }

  let startIdx = -1;
  for (let i = 0; i < allP.length; i++) {
    if (allP[i] === startElement) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return results;

  const majorSectionRe = /^[（(]?([一二三四五六七八九十]+)[）)]?[、.．]/;
  let stopPElement = null;
  if (stopNumChar) {
    for (let i = startIdx + 1; i < allP.length; i++) {
      const p = allP[i];
      const text = p.textContent.trim();
      if (text.length <= nameLengthLimit && text.includes(tableName)) continue;
      if (text.length <= nameLengthLimit) {
        const mj = majorSectionRe.exec(text);
        if (mj && mj[1] === stopNumChar) {
          stopPElement = p;
          addLog(`[子表格查找] 遇到下一章节，停止搜索`, 'info');
          break;
        }
      }
    }
  }

  function wrapIsInsideSection(wrap) {
    if (!(startElement.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
    if (stopPElement && !(wrap.compareDocumentPosition(stopPElement) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
    return true;
  }

  let suppressGapBeforeNextFlush = false;

  function flushBlock(title, rows) {
    if (!title || !rows || rows.length === 0) return;
    if (results.length > 0 && !suppressGapBeforeNextFlush) {
      results.push([]);
      results.push([]);
    }
    suppressGapBeforeNextFlush = false;
    results.push([title]);
    for (let r = 0; r < rows.length; r++) results.push(rows[r]);
  }

  let pendingTitle = null;
  let pendingRows = null;

  const allWraps = doc.querySelectorAll('div.table-wrap');
  for (const wrap of allWraps) {
    if (!wrapIsInsideSection(wrap)) continue;

    const table = wrap.querySelector('table');
    if (!table) continue;
    const parsed = parseTable(table);
    if (!isValidTable(parsed)) continue;

    const psib = wrap.previousElementSibling;
    const pTrim = psib && psib.tagName === 'P' ? psib.textContent.trim() : '';
    const prevEl = psib ? psib.previousElementSibling : null;
    const prevIsTableWrap = psib && psib.classList && psib.classList.contains('table-wrap');
    const gapThenWrap = psib && psib.tagName === 'P' && (pTrim === '/' || pTrim === '') &&
      prevEl && prevEl.classList && prevEl.classList.contains('table-wrap');

    if (pendingTitle && pendingRows && (prevIsTableWrap || gapThenWrap)) {
      pendingRows = mergeTableFragmentsToRows([pendingRows, parsed]);
      continue;
    }

    const prevPs = collectPrevSiblingPsBeforeWrap(wrap, 4);
    const meta = analyzeMergeNotesPrevPs(prevPs);
    const tableSubtitleP = pickTableSubtitleP(meta);
    let plainDigitLine = null;
    if (meta.conflict && meta.digitP) plainDigitLine = meta.digitP.textContent.trim();
    const titleText = tableSubtitleP ? buildMergeNotesTitleWithInterveningPs(tableSubtitleP, wrap) : null;

    if (titleText) {
      flushBlock(pendingTitle, pendingRows);
      if (plainDigitLine) {
        if (results.length > 0) {
          results.push([]);
          results.push([]);
        }
        results.push([plainDigitLine]);
        suppressGapBeforeNextFlush = true;
      }
      pendingTitle = titleText;
      pendingRows = parsed;
      addLog(`[子表格查找] table-wrap ← "${titleText.substring(0, 60)}"`, 'debug');
    }
  }

  flushBlock(pendingTitle, pendingRows);
  return results;
}
