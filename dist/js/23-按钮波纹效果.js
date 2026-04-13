// ==================== 按钮波纹效果 ====================
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.btn, .btn-file-action, .btn-clear-log, .secret-modal .btn-confirm, .secret-modal .btn-skip');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});
