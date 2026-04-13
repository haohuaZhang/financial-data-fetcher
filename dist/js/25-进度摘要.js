// ==================== 进度摘要 ====================
function updateProgressSummary(text) {
  const summary = document.getElementById('progressSummary');
  const summaryText = document.getElementById('progressSummaryText');
  if (!summary || !summaryText) return;
  if (text) {
    summaryText.textContent = text;
    summary.classList.add('active');
  } else {
    summary.classList.remove('active');
  }
}
