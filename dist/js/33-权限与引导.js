// ==================== 权限与引导 ====================

/* ---------- 权限守卫 ---------- */
function requirePremium() {
  // 正式用户（permanent模式）直接放行，不弹窗
  if (sessionStorage.getItem('secretVerified') === 'true'
      && sessionStorage.getItem('secretVerifiedMode') !== 'experience') {
    return true;
  }
  showUpgradeModal();
  return false;
}

/* ---------- 升级弹窗 ---------- */
function showUpgradeModal() {
  let overlay = document.getElementById('upgradeModalOverlay');
  if (overlay) { overlay.classList.add('active'); return; }
  overlay = document.createElement('div');
  overlay.id = 'upgradeModalOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '\
    <div class="upgrade-modal">\
      <div class="upgrade-modal__icon">&#128142;</div>\
      <div class="upgrade-modal__title">升级到专业版</div>\
      <div class="upgrade-modal__desc">解锁可视化图表、Excel模板导出、快速对比等高级功能</div>\
      <ul class="upgrade-modal__features">\
        <li>&#9989; 可视化图表报告（折线图/柱状图/雷达图）</li>\
        <li>&#9989; 杜邦分析 / 同行对比 / 多年趋势模板</li>\
        <li>&#9989; 快速数据对比 + Excel导出</li>\
        <li>&#9989; 优先技术支持</li>\
      </ul>\
      <div class="upgrade-modal__actions">\
        <button class="btn-upgrade-primary" onclick="closeUpgradeModal();document.getElementById(\'secretInput\')&&document.getElementById(\'secretInput\').focus();">输入暗号升级</button>\
        <button class="btn-upgrade-secondary" onclick="closeUpgradeModal();">稍后再说</button>\
      </div>\
    </div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeUpgradeModal(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('active'); });
}

function closeUpgradeModal() {
  var overlay = document.getElementById('upgradeModalOverlay');
  if (overlay) overlay.classList.remove('active');
}

/* ---------- 4步新手引导 ---------- */
var __guideState = { step: 0, total: 4, active: false };

function startGuide() {
  if (localStorage.getItem('guide_done') === '1') return;
  __guideState.step = 0;
  __guideState.active = true;
  showGuideOverlay();
}

function nextGuideStep() {
  __guideState.step++;
  if (__guideState.step >= __guideState.total) {
    endGuide();
    return;
  }
  showGuideOverlay();
}

function endGuide() {
  __guideState.active = false;
  var overlay = document.getElementById('guideOverlay');
  if (overlay) overlay.remove();
  try { localStorage.setItem('guide_done', '1'); } catch(e) {}
}

function showGuideOverlay() {
  var overlay = document.getElementById('guideOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'guideOverlay';
    overlay.className = 'guide-overlay';
    document.body.appendChild(overlay);
  }
  var tips = [
    { target: '#tabBtnFinance', title: '第1步：财务洞察', desc: '点击此标签查看自动汇总的财务指标和异常提醒', pos: 'bottom' },
    { target: '#tabBtnFiles', title: '第2步：文件管理', desc: '管理已采集的Excel/PDF文件，支持预览、对比和下载', pos: 'bottom' },
    { target: '#btnStartFetch', title: '第3步：开始采集', desc: '输入股票代码，一键批量获取财务报告数据', pos: 'bottom' },
    { target: '#configSection', title: '第4步：高级配置', desc: '自定义代理、板块筛选和采集参数', pos: 'bottom' }
  ];
  var info = tips[__guideState.step] || tips[0];
  var targetEl = document.querySelector(info.target);
  if (!targetEl) { endGuide(); return; }
  var rect = targetEl.getBoundingClientRect();
  overlay.innerHTML = '\
    <div class="guide-highlight" style="top:' + (rect.top - 4) + 'px;left:' + (rect.left - 4) + 'px;width:' + (rect.width + 8) + 'px;height:' + (rect.height + 8) + 'px;"></div>\
    <div class="guide-tooltip guide-tooltip--' + info.pos + '" style="top:' + (rect.bottom + 12) + 'px;left:' + (rect.left + rect.width / 2) + 'px;">\
      <div class="guide-tooltip__title">' + info.title + '</div>\
      <div class="guide-tooltip__desc">' + info.desc + '</div>\
      <div class="guide-tooltip__footer">\
        <span class="guide-tooltip__step">' + (__guideState.step + 1) + ' / ' + __guideState.total + '</span>\
        <button class="guide-tooltip__btn" onclick="nextGuideStep()">' + (__guideState.step < __guideState.total - 1 ? '下一步' : '完成') + '</button>\
        <button class="guide-tooltip__skip" onclick="endGuide()">跳过</button>\
      </div>\
    </div>';
}

/* ---------- 使用指南折叠 ---------- */
function toggleUsageGuide(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var isOpen = el.classList.contains('open');
  el.classList.toggle('open', !isOpen);
}
