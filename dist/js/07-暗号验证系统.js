// ==================== 暗号验证系统 ====================
const SECRET_CODES = ['我是坤哥你记住', '1', '张大帅', '林肥肥', '520'];
const EXPERIENCE_CODES = ['饿了会吃饭', '我是小帅', '鸡你太美', '重生之我在异世界当牛马', '2'];
const SECRET_MODE_KEY = 'secretVerifiedMode';
const EXPERIENCE_EXPIRED_KEY = 'experienceSecretExpired';
const SECRET_EXPIRE_MS = 3600000;
const EXPERIENCE_EXPIRE_MS = 3600000;
let guestModeActive = false;
let experienceBannerTimer = null;
let isMember = false; // 是否已验证暗号（门派弟子）
let secretExpired = false; // 暗号是否已过期

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
  if (!banner || !textEl || !countdownEl) return;

  const verified = sessionStorage.getItem('secretVerified') === 'true';
  const mode = sessionStorage.getItem(SECRET_MODE_KEY) || 'permanent';

  if (guestModeActive && !verified) {
    stopExperienceCountdown();
    banner.classList.add('active');
    textEl.textContent = getThemeText('guest-banner');
    countdownEl.textContent = '';
    return;
  }

  if (!verified) {
    stopExperienceCountdown();
    banner.classList.remove('active');
    textEl.textContent = getThemeText('guest-banner');
    countdownEl.textContent = '';
    return;
  }

  if (mode === 'experience') {
    stopExperienceCountdown();
    banner.classList.add('active');
    textEl.textContent = getThemeText('experience-banner');

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

  stopExperienceCountdown();
  banner.classList.remove('active');
  countdownEl.textContent = '';
  textEl.textContent = getThemeText('guest-banner');
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
    document.getElementById('secretModal').classList.add('hidden');
    showBottomToast(t('secret-toast-welcome'));
    renderAccessBanner();
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
    document.getElementById('secretModal').classList.add('hidden');
    showBottomToast(t('secret-toast-welcome'));
    renderAccessBanner();
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

// 底部Toast提示
function showBottomToast(msg) {
  const toast = document.getElementById('bottomToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
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
