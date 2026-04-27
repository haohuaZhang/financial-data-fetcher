// ==================== Tab 切换 ====================
function switchTab(tabName) {
  const tabBtnLog = document.getElementById('tabBtnLog');
  const tabBtnFiles = document.getElementById('tabBtnFiles');
  const panelLog = document.getElementById('panelLog');
  const panelFiles = document.getElementById('panelFiles');
  if (!tabBtnLog || !tabBtnFiles || !panelLog || !panelFiles) return;
  tabBtnLog.classList.toggle('active', tabName === 'log');
  tabBtnFiles.classList.toggle('active', tabName === 'files');
  const tabBtnFinance = document.getElementById('tabBtnFinance');
  if (tabBtnFinance) tabBtnFinance.classList.toggle('active', tabName === 'finance');
  panelLog.classList.toggle('active', tabName === 'log');
  panelFiles.classList.toggle('active', tabName === 'files');
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

function switchFinanceSubTab(subName) {
  var tabs = document.querySelectorAll('.finance-sub-tab');
  tabs.forEach(function(tab) {
    tab.classList.toggle('active', tab.getAttribute('data-sub') === subName);
  });
  var panels = document.querySelectorAll('.finance-sub-panel');
  panels.forEach(function(panel) {
    panel.classList.toggle('active', panel.getAttribute('data-sub') === subName);
  });
  if (subName === 'chart') {
    if (!requirePremium()) return;
    if (typeof loadECharts === 'function') {
      loadECharts(function() {
        if (typeof renderAllCharts === 'function') {
          setTimeout(renderAllCharts, 100);
        }
      });
    }
  }
}
