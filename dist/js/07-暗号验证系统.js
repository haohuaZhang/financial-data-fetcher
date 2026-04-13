// ==================== 暗号验证系统 ====================
const SECRET_CODES = ['我是坤哥你记住'];
let isMember = false; // 是否已验证暗号（门派弟子）
let secretExpired = false; // 暗号是否已过期

// 检查sessionStorage是否已验证
function checkSecretStatus() {
  const verified = sessionStorage.getItem('secretVerified');
  if (verified === 'true') {
    isMember = true;
    document.getElementById('secretModal').classList.add('hidden');
    // 每分钟检查一次是否过期
    setInterval(() => {
      if (isMember && checkSecretExpiry()) {
        // 过期后清除定时器不需要，因为checkSecretExpiry已经处理了
      }
    }, 60000);
    return;
  }
  // 显示弹框
  document.getElementById('secretModal').classList.remove('hidden');
  document.getElementById('secretInput').focus();
  // 如果是过期导致的，显示过期提示
  if (secretExpired) {
    document.getElementById('secretError').textContent = t('secret-expired');
    secretExpired = false;
  }
}

// 检查暗号是否已过期（超过1小时未操作）
function checkSecretExpiry() {
  if (!sessionStorage.getItem('secretVerified')) return false;
  const verifiedTime = parseInt(sessionStorage.getItem('secretVerifiedTime') || '0');
  if (Date.now() - verifiedTime > 3600000) {
    // 过期，清除验证状态
    sessionStorage.removeItem('secretVerified');
    sessionStorage.removeItem('secretVerifiedTime');
    isMember = false;
    secretExpired = true;
    document.getElementById('secretModal').classList.remove('hidden');
    document.getElementById('secretError').textContent = t('secret-expired');
    document.getElementById('secretInput').focus();
    return true;
  }
  return false;
}

// 更新暗号验证时间戳（每次用户操作时调用）
function updateSecretTime() {
  if (sessionStorage.getItem('secretVerified') === 'true') {
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

  if (SECRET_CODES.includes(input)) {
    // 暗号正确
    isMember = true;
    secretExpired = false;
    sessionStorage.setItem('secretVerified', 'true');
    sessionStorage.setItem('secretVerifiedTime', Date.now().toString());
    document.getElementById('secretModal').classList.add('hidden');
    showBottomToast(t('secret-toast-welcome'));
    // 启动过期检查定时器
    setInterval(() => {
      if (isMember && checkSecretExpiry()) {}
    }, 60000);
  } else {
    // 暗号错误
    errorEl.textContent = t('secret-error-wrong');
    inputEl.classList.add('error');
    setTimeout(() => inputEl.classList.remove('error'), 400);
  }
}

// 跳过暗号验证（散修模式）
function skipSecret() {
  document.getElementById('secretModal').classList.add('hidden');
  // 显示散修提示条
  document.getElementById('sanxiuBanner').classList.add('active');
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
