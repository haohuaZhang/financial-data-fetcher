// ==================== Section 折叠 ====================
function toggleSection(headerEl) {
  const section = headerEl.parentElement;
  const sectionBody = section.querySelector('.section-body');
  section.classList.toggle('open');
  headerEl.classList.toggle('collapsed');
  // BUG-B01: 同时toggle section-body的collapsed类（桌面端依赖此类控制显隐）
  if (sectionBody) {
    sectionBody.classList.toggle('collapsed');
  }
}
