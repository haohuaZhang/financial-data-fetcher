// ==================== UI 辅助函数 ====================
const LOG_THEME_TEXT_KEYS = [
  'log-ready', 'log-click-start', 'log-proxy-info', 'log-delay-info', 'log-file-info', 'log-pdf-link-info',
  'log-shortcut-start', 'log-shortcut-sheet', 'log-start', 'log-companies', 'log-years', 'log-report-types',
  'log-target-tables', 'log-need-pdf', 'log-available-proxies', 'log-guest-mode', 'log-no-company',
  'log-no-year', 'log-no-table', 'log-no-report', 'log-starting', 'log-search-stock', 'log-found-stock',
  'log-stock-search-fail', 'log-stock-not-found', 'log-stock-code', 'log-get-announcements', 'log-found-report',
  'log-no-report-found', 'log-loose-search', 'log-fetch-tables', 'log-find-table', 'log-table-found',
  'log-table-rows', 'log-table-from', 'log-table-fragments', 'log-table-not-found', 'log-remove-merge',
  'log-strategy-e', 'log-pdf-found', 'log-pdf-download', 'log-pdf-success', 'log-pdf-too-small',
  'log-pdf-error', 'log-pdf-link-saved', 'log-pdf-no-link', 'log-pdf-not-found', 'log-pdf-search-fail',
  'log-excel-gen', 'log-excel-done', 'log-zip-packing', 'log-zip-items', 'log-zip-pdf-links',
  'log-zip-pdf-links-suffix', 'log-zip-done', 'log-zip-fail', 'log-done', 'log-stopped',
  'log-result-summary', 'log-excel-files', 'log-pdf-files', 'log-pdf-link-files', 'log-failed-tasks',
  'log-failed-tasks-suffix', 'log-retry-hint', 'log-pdf-link-hint', 'log-stopped-msg',
  'log-stopped-progress', 'log-all-done', 'log-error-occurred', 'log-error-progress',
  'log-stopping', 'log-stopping-btn', 'log-proxy-cooldown', 'log-proxy-cooldown-msg', 'log-proxy-dispatch',
  'log-proxy-custom', 'log-proxy-all-fail', 'log-proxy-all-fail-msg', 'log-proxy-retry',
  'log-proxy-retry-suffix', 'log-proxy-retry-suffix2', 'log-proxy-countdown', 'log-proxy-seconds',
  'log-cache-hit', 'log-binary-all-fail', 'log-timeout', 'log-network-error', 'log-debug-no-match',
  'log-reading-report', 'log-decrypting', 'log-pdf-exception', 'log-no-proxy-input', 'log-testing-suffix',
  'log-test-done', 'log-test-available', 'log-test-status-good', 'log-test-content-short', 'log-company-done',
  'log-searching-stock', 'log-stock-code-found', 'log-stock-code-fail', 'log-exploring', 'log-searching-code',
  'log-stock-code-suffix', 'log-company-suffix', 'log-progress-idle', 'log-progress-idle2', 'status-waiting'
];

function getThemeMessages(themeId) {
  const theme = THEMES[themeId] || THEMES.normal;
  const extra = EXTRA_THEME_TEXTS[themeId] || {};
  const messages = [];
  const seen = new Set();
  for (const key of LOG_THEME_TEXT_KEYS) {
    const text = theme.texts?.[key] || extra[key] || EXTRA_THEME_TEXTS.normal?.[key] || THEMES.normal.texts?.[key];
    if (text && !seen.has(text)) {
      messages.push([key, text]);
      seen.add(text);
    }
  }
  messages.sort((a, b) => b[1].length - a[1].length);
  return messages;
}

function translateThemeTextFromTheme(text, fromThemeId, toThemeId) {
  let result = String(text);
  const sourceMessages = getThemeMessages(fromThemeId);
  const targetTheme = THEMES[toThemeId] || THEMES.normal;
  for (const [key, sourceText] of sourceMessages) {
    const targetText = (targetTheme.texts && targetTheme.texts[key])
      || (EXTRA_THEME_TEXTS[toThemeId] && EXTRA_THEME_TEXTS[toThemeId][key])
      || EXTRA_THEME_TEXTS.normal?.[key]
      || THEMES.normal.texts[key];
    if (sourceText && targetText && sourceText !== targetText && result.includes(sourceText)) {
      result = result.split(sourceText).join(targetText);
    }
  }
  return result;
}

function rethemeText(text, fromThemeId) {
  const sourceThemeId = fromThemeId || currentThemeId;
  let result = translateThemeTextFromTheme(text, sourceThemeId, currentThemeId);
  if (result === String(text)) {
    for (const themeId of Object.keys(THEMES)) {
      if (themeId === sourceThemeId) continue;
      const candidate = translateThemeTextFromTheme(text, themeId, currentThemeId);
      if (candidate !== String(text)) {
        result = candidate;
        break;
      }
    }
  }
  return result;
}

function buildLogTextLookup() {
  return getThemeMessages(currentThemeId);
}

function resolveLogEntry(msg) {
  const text = String(msg);
  for (const [key, value] of buildLogTextLookup()) {
    if (text === value) return { key, suffix: '' };
    if (text.startsWith(value)) {
      const suffix = text.slice(value.length);
      if (!suffix || /^[\s:：,\-（）()\[\]【】]/.test(suffix)) {
        return { key, suffix };
      }
    }
  }
  return { key: null, suffix: '', raw: text };
}

function renderLogHistory() {
  const logContent = document.getElementById('logContent');
  if (!logContent || !Array.isArray(window.__logHistory)) return;
  logContent.innerHTML = window.__logHistory.map(entry => {
    const text = entry.key
      ? `${t(entry.key)}${entry.suffix || ''}`
      : rethemeText(entry.raw, entry.themeId);
    return `<div class="log-entry ${entry.level}"><span class="log-time">[${entry.time}]</span><span class="log-msg">${escapeHtml(text)}</span></div>`;
  }).join('');
  logContent.scrollTop = logContent.scrollHeight;
}

function getTimestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

function addLog(msg, level = 'info') {
  const logContent = document.getElementById('logContent');
  if (!logContent) return;
  if (!Array.isArray(window.__logHistory)) window.__logHistory = [];
  const entryState = resolveLogEntry(msg);
  const logEntry = {
    time: getTimestamp(),
    level,
    key: entryState.key,
    suffix: entryState.suffix || '',
    themeId: currentThemeId,
    raw: String(msg),
  };
  window.__logHistory.push(logEntry);
  if (window.__logHistory.length > 500) window.__logHistory = window.__logHistory.slice(-500);
  const node = document.createElement('div');
  node.className = `log-entry ${level}`;
  node.innerHTML = `<span class="log-time">[${logEntry.time}]</span><span class="log-msg">${escapeHtml(logEntry.key ? `${t(logEntry.key)}${logEntry.suffix || ''}` : rethemeText(logEntry.raw, logEntry.themeId))}</span>`;
  logContent.appendChild(node);
  logContent.scrollTop = logContent.scrollHeight;
  logCountNum++;
  const logCountEl = document.getElementById('logCount');
  if (logCountEl) logCountEl.textContent = logCountNum;
}

function clearLog() {
  const logContent = document.getElementById('logContent');
  if (!logContent) return;
  logContent.innerHTML = '';
  window.__logHistory = [];
  logCountNum = 0;
  const logCountEl = document.getElementById('logCount');
  if (logCountEl) logCountEl.textContent = '0';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setProgress(title, current, total) {
  const progressTitle = document.getElementById('progressTitle');
  const progressStats = document.getElementById('progressStats');
  const bar = document.getElementById('progressBar');
  if (!progressTitle || !progressStats || !bar) return;
  progressTitle.textContent = title;
  progressStats.textContent = `${current} / ${total}`;
  const pct = total > 0 ? (current / total * 100) : 0;
  bar.classList.remove('indeterminate');
  bar.style.width = pct + '%';
}

function setProgressIndeterminate(title) {
  const progressTitle = document.getElementById('progressTitle');
  const progressStats = document.getElementById('progressStats');
  const bar = document.getElementById('progressBar');
  if (!progressTitle || !progressStats || !bar) return;
  progressTitle.textContent = title;
  progressStats.textContent = '...';
  bar.classList.add('indeterminate');
  bar.style.width = '30%';
}

// 公司状态列表
function initCompanyStatusList(companies) {
  const list = document.getElementById('companyStatusList');
  list.innerHTML = '';
  companies.forEach(name => {
    const item = document.createElement('div');
    item.className = 'company-status-item';
    item.id = `status-${name}`;
    item.innerHTML = `
      <span class="status-dot pending"></span>
      <span class="company-status-name">${escapeHtml(name)}</span>
      <span class="company-status-text">${t('status-waiting')}</span>
    `;
    list.appendChild(item);
  });
}

function updateCompanyStatus(name, status, text) {
  const item = document.getElementById(`status-${name}`);
  if (!item) return;
  const dot = item.querySelector('.status-dot');
  const label = item.querySelector('.company-status-text');
  dot.className = `status-dot ${status}`;
  label.textContent = text;
}
