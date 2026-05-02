// ==================== 暗号验证系统 ====================
const VIP_CODES = ['上山打老虎', 'vip', '林肥肥'];
const SECRET_CODES = ['我是坤哥你记住', '1', '张大帅', '520'];
const EXPERIENCE_CODES = ['饿了会吃饭', '我是小帅', '鸡你太美', '重生之我在异世界当牛马', '2'];
const SECRET_MODE_KEY = 'secretVerifiedMode';
const VIP_DISPLAY_NAME_KEY = 'vipDisplayName';
const EXPERIENCE_EXPIRED_KEY = 'experienceSecretExpired';
const SECRET_EXPIRE_MS = 3600000;
const EXPERIENCE_EXPIRE_MS = 3600000;
let guestModeActive = false;
let experienceBannerTimer = null;
let isMember = false; // 是否已验证暗号（门派弟子）
let secretExpired = false; // 暗号是否已过期

function escapeVipDisplayName(s) {
  if (s == null) return '';
  return String(s).replace(/[\u0000-\u001F<>]/g, '').trim().slice(0, 32);
}

function fillVipPlaceholders(str, name) {
  const n = escapeVipDisplayName(name) || 'VIP';
  return String(str || '').replace(/\{\{name\}\}/g, n);
}

function syncVipChrome() {
  const on = typeof isVipMember === 'function' && isVipMember();
  document.body.classList.toggle('vip-mode', on);
  const start = document.getElementById('btnStart');
  if (start) start.classList.toggle('btn-vip-primary', on);
  const deco = document.querySelector('.theme-bg-deco');
  if (deco) deco.classList.toggle('vip-deco-chrome', on);
  let badge = document.getElementById('headerVipBadge');
  if (on) {
    if (!badge) {
      const title = document.querySelector('.header-title');
      if (title && title.parentElement) {
        badge = document.createElement('span');
        badge.id = 'headerVipBadge';
        badge.className = 'header-vip-badge';
        badge.textContent = '✦ VIP ✦';
        badge.setAttribute('aria-label', 'VIP 尊享');
        title.parentElement.insertBefore(badge, title.nextSibling);
      }
    }
  } else if (badge) {
    badge.remove();
  }
}

function burstVipSparkles() {
  const cx = window.innerWidth * 0.5;
  const cy = Math.min(window.innerHeight * 0.2, 160);
  const n = 26;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = 'vip-sparkle';
    el.setAttribute('aria-hidden', 'true');
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 90 + Math.random() * 160;
    el.style.setProperty('--sx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    el.style.setProperty('--sy', (Math.sin(ang) * dist * 0.55 - 20).toFixed(1) + 'px');
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    document.body.appendChild(el);
    setTimeout(() => {
      try {
        el.remove();
      } catch (e) {}
    }, 1300);
  }
}

function playVipWelcomeFX() {
  const banner = document.getElementById('sanxiuBanner');
  if (banner) {
    banner.classList.remove('sanxiu-banner--vip-entrance');
    void banner.offsetWidth;
    banner.classList.add('sanxiu-banner--vip-entrance');
    setTimeout(() => banner.classList.remove('sanxiu-banner--vip-entrance'), 2600);
  }
  burstVipSparkles();
}

function isVipMember() {
  try {
    return sessionStorage.getItem('secretVerified') === 'true' &&
      sessionStorage.getItem(SECRET_MODE_KEY) === 'vip';
  } catch (e) {
    return false;
  }
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function stopExperienceCountdown() {
  if (experienceBannerTimer) {
    clearInterval(experienceBannerTimer);
    experienceBannerTimer = null;
  }
}

function isExperienceExpired() {
  return localStorage.getItem(EXPERIENCE_EXPIRED_KEY) === 'true';
}

function renderAccessBanner() {
  const banner = document.getElementById('sanxiuBanner');
  const textEl = document.getElementById('sanxiuBannerText');
  const countdownEl = document.getElementById('sanxiuBannerCountdown');
  const unlockBtn = document.getElementById('guestUnlockBtn');
  if (!banner || !textEl || !countdownEl) {
    syncVipChrome();
    return;
  }

  try {
    const verified = sessionStorage.getItem('secretVerified') === 'true';
    const mode = sessionStorage.getItem(SECRET_MODE_KEY) || 'permanent';

    banner.classList.remove('sanxiu-banner--vip');

    if (guestModeActive && !verified) {
      stopExperienceCountdown();
      banner.classList.add('active');
      textEl.textContent = getThemeText('guest-banner');
      countdownEl.textContent = '';
      if (unlockBtn) unlockBtn.style.display = '';
      return;
    }

    if (!verified) {
      stopExperienceCountdown();
      banner.classList.remove('active');
      textEl.textContent = getThemeText('guest-banner');
      countdownEl.textContent = '';
      if (unlockBtn) unlockBtn.style.display = '';
      return;
    }

    if (mode === 'experience') {
      stopExperienceCountdown();
      banner.classList.add('active');
      textEl.textContent = getThemeText('experience-banner');
      if (unlockBtn) unlockBtn.style.display = 'none';

      const updateCountdown = () => {
        const verifiedTime = parseInt(sessionStorage.getItem('secretVerifiedTime') || '0');
        const remaining = EXPERIENCE_EXPIRE_MS - (Date.now() - verifiedTime);
        if (remaining <= 0) {
          stopExperienceCountdown();
          countdownEl.textContent = '';
          checkSecretExpiry();
          return;
        }
        countdownEl.textContent = `${formatCountdown(remaining)} 后失效`;
      };

      updateCountdown();
      experienceBannerTimer = setInterval(updateCountdown, 1000);
      return;
    }

    if (mode === 'vip') {
      stopExperienceCountdown();
      banner.classList.add('active');
      banner.classList.add('sanxiu-banner--vip');
      const stored = sessionStorage.getItem(VIP_DISPLAY_NAME_KEY) || '';
      const displayName = escapeVipDisplayName(stored) || 'VIP';
      textEl.textContent = fillVipPlaceholders(getThemeText('vip-banner'), displayName);
      const extra = getThemeText('vip-banner-extra');
      countdownEl.textContent = extra ? fillVipPlaceholders(extra, displayName) : '';
      if (unlockBtn) unlockBtn.style.display = 'none';
      return;
    }

    stopExperienceCountdown();
    banner.classList.remove('active');
    countdownEl.textContent = '';
    textEl.textContent = getThemeText('guest-banner');
    if (unlockBtn) unlockBtn.style.display = '';
  } finally {
    syncVipChrome();
  }
}

// 检查sessionStorage是否已验证
function checkSecretStatus() {
  if (checkSecretExpiry()) return;
  const verified = sessionStorage.getItem('secretVerified');
  if (verified === 'true') {
    isMember = true;
    guestModeActive = false;
    document.getElementById('secretModal').classList.add('hidden');
    renderAccessBanner();
    return;
  }
  // 显示弹框
  document.getElementById('secretModal').classList.remove('hidden');
  document.getElementById('secretInput').focus();
  // 如果是过期导致的，显示过期提示
  if (secretExpired) {
    const expiredKey = isExperienceExpired() ? 'secret-experience-expired' : 'secret-expired';
    document.getElementById('secretError').textContent = t(expiredKey);
    secretExpired = false;
  }
  if (isExperienceExpired()) {
    document.getElementById('secretError').textContent = t('secret-experience-expired');
  }
  renderAccessBanner();
}

// 检查暗号是否已过期
function checkSecretExpiry() {
  if (!sessionStorage.getItem('secretVerified')) return false;
  const mode = sessionStorage.getItem(SECRET_MODE_KEY) || 'permanent';
  const verifiedTime = parseInt(sessionStorage.getItem('secretVerifiedTime') || '0');
  const expireMs = mode === 'experience' ? EXPERIENCE_EXPIRE_MS : SECRET_EXPIRE_MS;
  if (Date.now() - verifiedTime > expireMs) {
    // 过期，清除验证状态
    sessionStorage.removeItem('secretVerified');
    sessionStorage.removeItem('secretVerifiedTime');
    sessionStorage.removeItem(SECRET_MODE_KEY);
    sessionStorage.removeItem(VIP_DISPLAY_NAME_KEY);
    guestModeActive = false;
    isMember = false;
    secretExpired = true;
    if (mode === 'experience') {
      localStorage.setItem(EXPERIENCE_EXPIRED_KEY, 'true');
      document.getElementById('secretError').textContent = t('secret-experience-expired');
    } else {
      document.getElementById('secretError').textContent = t('secret-expired');
    }
    document.getElementById('secretModal').classList.remove('hidden');
    renderAccessBanner();
    // 移除积分提示
    var hint1 = document.getElementById('checkinBannerHint');
    if (hint1) hint1.remove();
    document.getElementById('secretInput').focus();
    return true;
  }
  return false;
}

// 更新暗号验证时间戳（每次用户操作时调用）
function updateSecretTime() {
  if (sessionStorage.getItem('secretVerified') === 'true' && sessionStorage.getItem(SECRET_MODE_KEY) !== 'experience') {
    sessionStorage.setItem('secretVerifiedTime', Date.now().toString());
  }
}

// 验证暗号
function verifySecret() {
  const input = document.getElementById('secretInput').value.trim();
  const errorEl = document.getElementById('secretError');
  const inputEl = document.getElementById('secretInput');

  if (!input) {
    errorEl.textContent = t('secret-error-empty');
    inputEl.classList.add('error');
    setTimeout(() => inputEl.classList.remove('error'), 400);
    return;
  }

  if (VIP_CODES.includes(input)) {
    isMember = true;
    guestModeActive = false;
    secretExpired = false;
    const rawIn = input.trim();
    const vipLabel = escapeVipDisplayName(rawIn) || rawIn.slice(0, 32) || 'VIP';
    sessionStorage.setItem(VIP_DISPLAY_NAME_KEY, vipLabel);
    sessionStorage.setItem('secretVerified', 'true');
    sessionStorage.setItem(SECRET_MODE_KEY, 'vip');
    sessionStorage.setItem('secretVerifiedTime', Date.now().toString());
    localStorage.removeItem(EXPERIENCE_EXPIRED_KEY);
    document.getElementById('secretModal').classList.add('hidden');
    showBottomToast(fillVipPlaceholders(getThemeText('vip-toast'), vipLabel), 6200, 'bottom-toast--vip');
    renderAccessBanner();
    playVipWelcomeFX();
    var hintVip = document.getElementById('checkinBannerHint');
    if (hintVip) hintVip.remove();
    if (typeof updateHeaderPoints === 'function') updateHeaderPoints();
    return;
  }

  if (EXPERIENCE_CODES.includes(input)) {
    if (isExperienceExpired()) {
      errorEl.textContent = t('secret-experience-expired');
      inputEl.classList.add('error');
      setTimeout(() => inputEl.classList.remove('error'), 400);
      return;
    }
    const verifiedTime = parseInt(sessionStorage.getItem('secretVerifiedTime') || '0');
    if (verifiedTime && Date.now() - verifiedTime > EXPERIENCE_EXPIRE_MS) {
      sessionStorage.removeItem('secretVerified');
      sessionStorage.removeItem('secretVerifiedTime');
      sessionStorage.removeItem(SECRET_MODE_KEY);
      sessionStorage.removeItem(VIP_DISPLAY_NAME_KEY);
      localStorage.setItem(EXPERIENCE_EXPIRED_KEY, 'true');
      isMember = false;
      secretExpired = true;
      errorEl.textContent = t('secret-experience-expired');
      inputEl.classList.add('error');
      setTimeout(() => inputEl.classList.remove('error'), 400);
      return;
    }
    isMember = true;
    guestModeActive = false;
    secretExpired = false;
    sessionStorage.setItem('secretVerified', 'true');
    sessionStorage.setItem(SECRET_MODE_KEY, 'experience');
    sessionStorage.setItem('secretVerifiedTime', Date.now().toString());
    sessionStorage.removeItem(VIP_DISPLAY_NAME_KEY);
    document.getElementById('secretModal').classList.add('hidden');
    showBottomToast(t('secret-toast-welcome'));
    renderAccessBanner();
    // 更新积分提示 + 显示积分徽章
    if (typeof appendCheckinHintToBanner === 'function') appendCheckinHintToBanner();
    if (typeof updateHeaderPoints === 'function') updateHeaderPoints();
    // 延迟弹出签到面板
    if (typeof scheduleAutoCheckin === 'function') scheduleAutoCheckin();
    return;
  }

  if (SECRET_CODES.includes(input)) {
    // 暗号正确
    isMember = true;
    guestModeActive = false;
    secretExpired = false;
    sessionStorage.setItem('secretVerified', 'true');
    sessionStorage.setItem(SECRET_MODE_KEY, 'permanent');
    sessionStorage.setItem('secretVerifiedTime', Date.now().toString());
    sessionStorage.removeItem(VIP_DISPLAY_NAME_KEY);
    // 正式暗号验证成功，清除体验过期标记
    localStorage.removeItem(EXPERIENCE_EXPIRED_KEY);
    document.getElementById('secretModal').classList.add('hidden');
    showBottomToast(t('secret-toast-welcome'));
    renderAccessBanner();
    // 移除积分提示（永久模式不需要延用提示）
    var hint2 = document.getElementById('checkinBannerHint');
    if (hint2) hint2.remove();
    // 显示积分徽章
    if (typeof updateHeaderPoints === 'function') updateHeaderPoints();
  } else {
    // 暗号错误
    errorEl.textContent = t('secret-error-wrong');
    inputEl.classList.add('error');
    setTimeout(() => inputEl.classList.remove('error'), 400);
  }
}

// 跳过暗号验证（散修模式）
function skipSecret() {
  guestModeActive = true;
  document.getElementById('secretModal').classList.add('hidden');
  // 显示散修提示条
  renderAccessBanner();
  // 隐藏积分徽章（游客模式）
  if (typeof updateHeaderPoints === 'function') updateHeaderPoints();
  // 显示底部Toast
  showBottomToast(t('guest-toast'));
  // 限制功法等级只能选一个
  restrictReportTypes();
  // 确保散修模式下只有一个checkbox被选中
  const activeItems = document.querySelectorAll('#reportTypes .checkbox-item.active');
  if (activeItems.length > 1) {
    for (let i = 1; i < activeItems.length; i++) {
      activeItems[i].classList.remove('active');
      activeItems[i].querySelector('input').checked = false;
    }
  }
}

let __bottomToastTimer = null;
function showBottomToast(msg, durationMs, extraClass) {
  const toast = document.getElementById('bottomToast');
  if (!toast) return;
  if (__bottomToastTimer) {
    clearTimeout(__bottomToastTimer);
    __bottomToastTimer = null;
  }
  toast.className = 'bottom-toast' + (extraClass ? ' ' + extraClass : '');
  toast.textContent = msg;
  toast.classList.add('show');
  const ms = durationMs != null ? durationMs : 2000;
  __bottomToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    __bottomToastTimer = null;
  }, ms);
}

// 限制功法等级只能选一个（散修模式）
function restrictReportTypes() {
  document.querySelectorAll('#reportTypes .checkbox-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation(); // BUG-A01/C01: 阻止冒泡，避免与通用checkbox处理器冲突
      if (isMember) {
        this.classList.toggle('active');
        const cb = this.querySelector('input');
        cb.checked = this.classList.contains('active');
        return;
      }
      // 散修模式：只能选一个，点击新的会取消其他
      const wasActive = this.classList.contains('active');
      document.querySelectorAll('#reportTypes .checkbox-item').forEach(i => {
        i.classList.remove('active');
        i.querySelector('input').checked = false;
      });
      if (!wasActive) {
        this.classList.add('active');
        this.querySelector('input').checked = true;
      }
    }, true); // 用capture确保优先执行
  });
}

// 页面加载时检查暗号状态
checkSecretStatus();

// 回车键提交暗号
document.getElementById('secretInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') verifySecret();
});

// 全局事件监听器：每次用户操作时更新暗号验证时间
document.addEventListener('click', updateSecretTime);
document.addEventListener('keydown', updateSecretTime);

// BUG-A02: 防止暗号弹框内部点击冒泡到overlay
document.querySelector('.secret-modal').addEventListener('click', function(e) {
  e.stopPropagation();
});

// ESC键关闭暗号弹框（等同于跳过）
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !document.getElementById('secretModal').classList.contains('hidden')) {
    skipSecret();
  }
});
