// ==================== Tab 切换 ====================
function switchTab(tabName) {
  document.getElementById('tabBtnLog').classList.toggle('active', tabName === 'log');
  document.getElementById('tabBtnFiles').classList.toggle('active', tabName === 'files');
  document.getElementById('panelLog').classList.toggle('active', tabName === 'log');
  document.getElementById('panelFiles').classList.toggle('active', tabName === 'files');
  if (tabName === 'files') {
    renderFileList();
  }
}
