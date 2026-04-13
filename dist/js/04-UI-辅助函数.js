// ==================== UI 辅助函数 ====================
function getTimestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

function addLog(msg, level = 'info') {
  const logContent = document.getElementById('logContent');
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  entry.innerHTML = `<span class="log-time">[${getTimestamp()}]</span><span class="log-msg">${escapeHtml(msg)}</span>`;
  logContent.appendChild(entry);
  logContent.scrollTop = logContent.scrollHeight;
  logCountNum++;
  document.getElementById('logCount').textContent = logCountNum;
}

function clearLog() {
  document.getElementById('logContent').innerHTML = '';
  logCountNum = 0;
  document.getElementById('logCount').textContent = '0';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setProgress(title, current, total) {
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressStats').textContent = `${current} / ${total}`;
  const pct = total > 0 ? (current / total * 100) : 0;
  const bar = document.getElementById('progressBar');
  bar.classList.remove('indeterminate');
  bar.style.width = pct + '%';
}

function setProgressIndeterminate(title) {
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressStats').textContent = '...';
  const bar = document.getElementById('progressBar');
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
