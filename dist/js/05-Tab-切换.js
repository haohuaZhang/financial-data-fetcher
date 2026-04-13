// ==================== Tab 切换 ====================
function switchTab(tabName) {
  document.getElementById('tabBtnLog').classList.toggle('active', tabName === 'log');
  document.getElementById('tabBtnFiles').classList.toggle('active', tabName === 'files');
  const tabBtnFinance = document.getElementById('tabBtnFinance');
  if (tabBtnFinance) tabBtnFinance.classList.toggle('active', tabName === 'finance');
  document.getElementById('panelLog').classList.toggle('active', tabName === 'log');
  document.getElementById('panelFiles').classList.toggle('active', tabName === 'files');
  const panelFinance = document.getElementById('panelFinance');
  if (panelFinance) panelFinance.classList.toggle('active', tabName === 'finance');
  if (tabName === 'files') {
    if (typeof window.__loadFeatureGroup === 'function') {
      void window.__loadFeatureGroup('preview');
    }
    renderFileList();
  }
  if (tabName === 'finance' && typeof refreshFinanceInsights === 'function') {
    refreshFinanceInsights();
  }
}
