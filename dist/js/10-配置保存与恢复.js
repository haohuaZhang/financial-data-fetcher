// ==================== 配置保存与恢复 ====================
function saveConfig() {
  // BUG-A04: 使用getRawConfig保存完整配置，避免散修阉割后的配置被保存
  const config = getRawConfig();
  localStorage.setItem('financialFetcherConfig', JSON.stringify(config));
}

function loadConfig() {
  const saved = localStorage.getItem('financialFetcherConfig');
  if (saved) {
    try {
      const config = JSON.parse(saved);
      if (config.companies) document.getElementById('companies').value = config.companies.join('\n');
      if (config.years) document.getElementById('years').value = config.years.join(', ');
      if (config.targetTables) document.getElementById('targetTables').value = config.targetTables.join('\n');
      if (config.nameLength) document.getElementById('nameLength').value = config.nameLength;
      if (config.customProxies) document.getElementById('customProxies').value = config.customProxies.join('\n');
      if (config.reportTypes) {
        document.querySelectorAll('#reportTypes .checkbox-item').forEach(item => {
          const isActive = config.reportTypes.includes(item.dataset.value);
          item.classList.toggle('active', isActive);
          // BUG-A03: 同步checkbox.checked状态
          const cb = item.querySelector('input');
          if (cb) cb.checked = isActive;
        });
      }
      // BUG-D06: 使用严格布尔判断
      if (config.needPdf === true) document.getElementById('needPdfSwitch').classList.add('active');
      if (config.useCustomProxy === true) document.getElementById('useCustomProxySwitch').classList.add('active');
      addLog(t('log-config-restored'), 'info');
    } catch (e) {
      console.error('恢复修炼配置失败:', e);
    }
  }
}

// 页面加载时恢复配置
window.addEventListener('load', loadConfig);
