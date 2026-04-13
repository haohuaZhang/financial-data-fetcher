// ==================== Checkbox / Switch 逻辑 ====================
document.querySelectorAll('.checkbox-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault(); // 阻止label默认行为，避免双重toggle
    item.classList.toggle('active');
    const cb = item.querySelector('input');
    cb.checked = item.classList.contains('active');
  });
});

document.getElementById('needPdfSwitch').addEventListener('click', function(e) {
  e.preventDefault();
  this.classList.toggle('active');
});

// 自定义代理开关
document.getElementById('useCustomProxySwitch').addEventListener('click', function(e) {
  e.preventDefault();
  this.classList.toggle('active');
});
