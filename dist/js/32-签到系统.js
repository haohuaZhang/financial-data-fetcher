// ==================== 签到积分系统 ====================
var CHECKIN_EXTEND_COST = 10;

function getCheckinData() {
  try {
    var raw = localStorage.getItem('checkinData');
    return raw ? JSON.parse(raw) : { points: 0, streak: 0, lastCheckin: null };
  } catch (e) {
    return { points: 0, streak: 0, lastCheckin: null };
  }
}

function saveCheckinData(data) {
  try { localStorage.setItem('checkinData', JSON.stringify(data)); } catch (e) {}
}

function getCheckinPoints() {
  return getCheckinData().points;
}

function canCheckin() {
  var data = getCheckinData();
  if (!data.lastCheckin) return true;
  var today = new Date().toDateString();
  return data.lastCheckin !== today;
}

function doCheckin() {
  if (!canCheckin()) return;
  var data = getCheckinData();
  var today = new Date().toDateString();
  var yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastCheckin === yesterday) {
    data.streak++;
  } else {
    data.streak = 1;
  }
  var bonus = data.streak >= 7 ? 5 : data.streak >= 3 ? 3 : 2;
  data.points += bonus;
  data.lastCheckin = today;
  saveCheckinData(data);
  updateHeaderPoints();
  // 签到后更新横幅积分提示
  var hint = document.getElementById('checkinBannerHint');
  if (hint) hint.textContent = '\uD83E\uDE99 ' + data.points + '积分 | 签到领积分可延用体验';
  renderCheckinModal();
}

function isGuestMode() {
  try { return sessionStorage.secretVerified !== 'true'; } catch (e) { return true; }
}

function openCheckinModal() {
  renderCheckinModal();
  var modal = document.getElementById('checkinModal');
  if (modal) modal.classList.remove('hidden');
}

function closeCheckinModal() {
  var modal = document.getElementById('checkinModal');
  if (modal) modal.classList.add('hidden');
}

function renderCheckinModal() {
  var data = getCheckinData();
  var pointsEl = document.getElementById('checkinPoints');
  var streakEl = document.getElementById('checkinStreak');
  var rewardEl = document.getElementById('checkinRewardHint');
  var btnEl = document.getElementById('checkinBtn');
  var extendWrap = document.getElementById('extendBtnWrap');

  if (pointsEl) pointsEl.textContent = data.points;
  if (streakEl) streakEl.textContent = data.streak;

  var bonus = data.streak >= 7 ? 5 : data.streak >= 3 ? 3 : 2;
  if (rewardEl) rewardEl.textContent = data.streak >= 7 ? '连续签到7天+，每次+5积分' : data.streak >= 3 ? '连续签到3天+，每次+3积分' : '每日签到+2积分';

  if (btnEl) {
    if (canCheckin()) {
      btnEl.textContent = '签到 +' + bonus;
      btnEl.disabled = false;
      btnEl.style.opacity = '1';
    } else {
      btnEl.textContent = '\u2705 今日已签到';
      btnEl.disabled = true;
      btnEl.style.opacity = '0.5';
    }
  }

  if (extendWrap) {
    var mode = sessionStorage.getItem(SECRET_MODE_KEY) || '';
    if (data.points >= CHECKIN_EXTEND_COST && mode === 'experience') {
      extendWrap.innerHTML = '<button onclick="handleExtendExperience()" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;width:100%;margin-top:8px">延用体验1天 (-' + CHECKIN_EXTEND_COST + '积分)</button>';
    } else {
      extendWrap.innerHTML = '';
    }
  }
}

function handleExtendExperience() {
  var data = getCheckinData();
  if (data.points < CHECKIN_EXTEND_COST) return;
  data.points -= CHECKIN_EXTEND_COST;
  saveCheckinData(data);
  // 延长体验1天
  var verifiedTime = parseInt(sessionStorage.getItem('secretVerifiedTime') || '0');
  if (verifiedTime) {
    sessionStorage.setItem('secretVerifiedTime', (verifiedTime + 86400000).toString());
  }
  updateHeaderPoints();
  renderCheckinModal();
  if (typeof renderAccessBanner === 'function') renderAccessBanner();
  updateBannerHintText();
  if (typeof showBottomToast === 'function') showBottomToast('体验已延长1天！');
}

function updateHeaderPoints() {
  var wrap = document.getElementById('headerPointsWrap');
  var el = document.getElementById('headerPoints');
  if (!wrap || !el) return;
  if (isGuestMode()) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  el.textContent = '\uD83E\uDE99' + getCheckinPoints();
}

function appendCheckinHintToBanner() {
  var banner = document.getElementById('sanxiuBanner');
  if (!banner) return;
  var mode = sessionStorage.getItem(SECRET_MODE_KEY) || '';
  if (mode !== 'experience') return;
  if (document.getElementById('checkinBannerHint')) return;
  createBannerHint(banner);
}

function updateBannerHintText() {
  var hint = document.getElementById('checkinBannerHint');
  if (hint) {
    hint.textContent = '\uD83E\uDE99 ' + getCheckinPoints() + '积分 | 签到领积分可延用体验';
  }
}

function createBannerHint(banner) {
  var span = document.createElement('span');
  span.id = 'checkinBannerHint';
  span.style.cssText = 'margin-left:12px;font-size:12px;cursor:pointer;color:var(--accent-text)';
  span.textContent = '\uD83E\uDE99 ' + getCheckinPoints() + '积分 | 签到领积分可延用体验';
  span.onclick = function () { openCheckinModal(); };
  banner.appendChild(span);
}

function scheduleAutoCheckin() {
  if (isGuestMode()) return;
  setTimeout(function () {
    if (canCheckin()) openCheckinModal();
  }, 3000);
}

// 创建签到弹窗DOM
(function () {
  var overlay = document.createElement('div');
  overlay.id = 'checkinModal';
  overlay.className = 'modal-overlay hidden';
  overlay.style.cssText = 'z-index:10000';
  overlay.innerHTML = '<div class="modal-content" style="max-width:400px;text-align:center;padding:32px;position:relative">' +
    '<button onclick="closeCheckinModal()" style="position:absolute;top:12px;right:16px;font-size:20px;background:none;border:none;cursor:pointer">\u00d7</button>' +
    '<div style="font-size:48px;margin-bottom:8px">\uD83C\uDFAF</div>' +
    '<div style="font-size:14px;color:var(--text-muted);margin-bottom:16px">\u6BCF\u65E5\u7B7E\u5230</div>' +
    '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:20px">' +
    '<div><div style="font-size:28px;font-weight:700" id="checkinPoints">0</div><div style="font-size:12px;color:var(--text-muted)">\u5F53\u524D\u79EF\u5206</div></div>' +
    '<div><div style="font-size:28px;font-weight:700" id="checkinStreak">0</div><div style="font-size:12px;color:var(--text-muted)">\u8FDE\u7EED\u7B7E\u5230</div></div>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:16px" id="checkinRewardHint"></div>' +
    '<button id="checkinBtn" onclick="doCheckin()" style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;width:100%">\u7B7E\u5230 +2</button>' +
    '<div id="extendBtnWrap" style="margin-top:12px"></div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeCheckinModal(); });
})();

// 初始化header积分显示
updateHeaderPoints();
