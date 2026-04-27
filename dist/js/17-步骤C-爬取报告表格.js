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

    if (foundTables.length > 0) {
      // 合并所有找到的表格数据（处理跨页情况）
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
 * 解析HTML table元素为二维数组
 */
function parseTable(tableEl) {
  const rows = [];
  const trs = tableEl.querySelectorAll('tr');
  for (const tr of trs) {
    const cells = [];
    const tds = tr.querySelectorAll('td, th');
    for (const td of tds) {
      let text = td.textContent.trim().replace(/\s+/g, ' ');
      const colspan = parseInt(td.getAttribute('colspan')) || 1;
      cells.push(text);
      for (let c = 1; c < colspan; c++) {
        cells.push('');
      }
    }
    rows.push(cells);
  }
  return rows;
}
