// ==================== 配置自动保存（debounce） ====================
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveConfig();
  }, 1000);
}

// 监听配置输入变化，自动保存
['companies', 'years', 'targetTables', 'nameLength', 'customProxies'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', scheduleAutoSave);
    el.addEventListener('change', scheduleAutoSave);
  }
});
