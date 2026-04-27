// ==================== 配置模板功能 ====================
function getConfigTemplates() {
  try {
    return JSON.parse(localStorage.getItem('configTemplates') || '[]');
  } catch (e) {
    return [];
  }
}

function saveConfigTemplates(templates) {
  localStorage.setItem('configTemplates', JSON.stringify(templates));
}

function refreshConfigTemplateSelect() {
  const select = document.getElementById('configTemplateSelect');
  if (!select) return;
  const templates = getConfigTemplates();
  let html = `<option value="">${t('config-select-placeholder')}</option>`;
  templates.forEach((tpl, idx) => {
    html += `<option value="${idx}">${escapeHtml(tpl.name)}</option>`;
  });
  select.innerHTML = html;
}

function saveConfigTemplate() {
  const config = getRawConfig();
  const templates = getConfigTemplates();
  if (templates.length >= 10) {
    showBottomToast(t('config-max-templates'));
    return;
  }

  // BUG-T6: 使用内联输入框替代 prompt()
  let overlay = document.getElementById('saveTemplateModalOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'saveTemplateModalOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '\
    <div class="secret-modal" style="max-width:400px;width:90%;">\
      <div class="secret-icon">&#128190;</div>\
      <div class="secret-hint">' + (t('config-save-name') || '请输入模板名称') + '</div>\
      <input class="secret-input" id="saveTemplateNameInput" type="text" placeholder="' + (t('config-name-placeholder') || '我的模板') + '" maxlength="30" />\
      <div class="secret-actions">\
        <button class="btn-confirm" id="saveTemplateNameConfirm">' + (t('btn-confirm') || '确认') + '</button>\
        <button class="btn-skip" id="saveTemplateNameCancel">' + (t('btn-cancel') || '取消') + '</button>\
      </div>\
    </div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('active'); });

  var input = document.getElementById('saveTemplateNameInput');
  input.focus();

  function closeModal() {
    overlay.classList.remove('active');
    setTimeout(function() { overlay.remove(); }, 300);
  }

  function doSave() {
    var name = input.value.trim();
    if (!name) {
      input.classList.add('error');
      setTimeout(function() { input.classList.remove('error'); }, 400);
      return;
    }
    templates.push({
      name: name,
      config: config,
      createdAt: new Date().toISOString()
    });
    saveConfigTemplates(templates);
    refreshConfigTemplateSelect();
    showBottomToast(t('config-saved'));
    closeModal();
  }

  document.getElementById('saveTemplateNameConfirm').addEventListener('click', doSave);
  document.getElementById('saveTemplateNameCancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') closeModal();
  });
}

function loadConfigTemplate() {
  const select = document.getElementById('configTemplateSelect');
  if (!select) return;
  const idx = parseInt(select.value);
  if (isNaN(idx)) {
    showBottomToast(t('config-select-first'));
    return;
  }

  const templates = getConfigTemplates();
  if (!templates[idx]) return;

  const config = templates[idx].config;
  if (config.companies) document.getElementById('companies').value = config.companies.join('\n');
  if (config.years) document.getElementById('years').value = config.years.join(', ');
  if (config.targetTables) document.getElementById('targetTables').value = config.targetTables.join('\n');
  if (config.nameLength) document.getElementById('nameLength').value = config.nameLength;
  if (config.customProxies) document.getElementById('customProxies').value = config.customProxies.join('\n');
  if (config.reportTypes) {
    document.querySelectorAll('#reportTypes .checkbox-item').forEach(item => {
      const isActive = config.reportTypes.includes(item.dataset.value);
      item.classList.toggle('active', isActive);
      const cb = item.querySelector('input');
      if (cb) cb.checked = isActive;
    });
  }
  if (config.needPdf === true) document.getElementById('needPdfSwitch').classList.add('active');
  else document.getElementById('needPdfSwitch').classList.remove('active');
  if (config.useCustomProxy === true) document.getElementById('useCustomProxySwitch').classList.add('active');
  else document.getElementById('useCustomProxySwitch').classList.remove('active');

  showBottomToast(t('config-loaded'));
}

function deleteConfigTemplate() {
  const select = document.getElementById('configTemplateSelect');
  const idx = parseInt(select.value);
  if (isNaN(idx)) {
    showBottomToast(t('config-select-first'));
    return;
  }
  let templates = JSON.parse(localStorage.getItem('configTemplates') || '[]');
  templates.splice(idx, 1);
  localStorage.setItem('configTemplates', JSON.stringify(templates));
  refreshConfigTemplateSelect();
  showBottomToast(t('config-deleted'));
}

// 页面加载时刷新模板下拉列表
window.addEventListener('load', refreshConfigTemplateSelect);
