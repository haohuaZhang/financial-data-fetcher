(() => {
  const assetBase = window.__APP_ASSET_BASE__ || '.';
  const assetVersion = window.__APP_VERSION__ || '20260427c';
  const withVersion = path => `${assetBase}/${path}?v=${assetVersion}`;
  const fragmentPaths = [
    withVersion('fragments/decorations.fragment'),
    withVersion('fragments/header.fragment'),
    withVersion('fragments/left-panel.fragment'),
    withVersion('fragments/right-panel.fragment'),
    withVersion('fragments/modals.fragment'),
  ];

  const groupScripts = {
    shell: [
      '01-主题系统.js',
      '02-全局状态.js',
      '03-CORS代理系统-全面升级.js',
      '04-UI-辅助函数.js',
      '05-Tab-切换.js',
      '06-Section-折叠.js',
      '07-暗号验证系统.js',
      '08-Checkbox-Switch-逻辑.js',
      '09-配置解析.js',
      '10-配置保存与恢复.js',
      '20-储物袋面板.js',
      '23-按钮波纹效果.js',
      '24-配置自动保存-debounce.js',
      '25-进度摘要.js',
      '31-财务洞察.js',
      '30-section-30.js',
      '32-签到系统.js',
      '33-权限与引导.js',
    ],
    fetch: [
      '11-CORS代理请求-文本内容-智能轮换.js',
      '12-CORS代理请求-二进制内容-用于PDF.js',
      '13-工具函数.js',
      '14-功法等级映射.js',
      '15-步骤A-搜索股票代码.js',
      '16-步骤B-获取秘籍目录-宽松匹配.js',
      '17-步骤C-爬取报告表格.js',
      '18-步骤D-玉简获取-增强链接查找.js',
      '19-Excel-生成.js',
      '22-主流程.js',
    ],
    preview: [
      '11-CORS代理请求-文本内容-智能轮换.js',
      '12-CORS代理请求-二进制内容-用于PDF.js',
      '21-文件预览.js',
      '28-图表可视化功能.js',
    ],
    compare: [
      '29-数据对比功能.js',
      '34-Excel模板生成.js',
    ],
    settings: [
      '26-测试自定义代理.js',
      '27-配置模板功能.js',
    ],
    chart: [
      '35-可视化图表报告.js',
    ],
  };

  const fnGroups = {
    clearLog: ['shell'],
    switchTab: ['shell'],
    toggleSection: ['shell'],
    verifySecret: ['shell'],
    skipSecret: ['shell'],
    startFetching: ['shell', 'fetch'],
    stopFetching: ['shell', 'fetch'],
    selectAllFiles: ['shell'],
    deselectAllFiles: ['shell'],
    renderFileList: ['shell'],
    updateDownloadButton: ['shell'],
    downloadSelectedZip: ['shell'],
    previewFile: ['shell', 'preview'],
    closePreviewModal: ['shell', 'preview'],
    switchExcelSheet: ['shell', 'preview'],
    showChartArea: ['shell', 'preview'],
    openCompareModal: ['shell', 'compare'],
    closeCompareModal: ['shell', 'compare'],
    testCustomProxies: ['shell', 'settings'],
    saveConfigTemplate: ['shell', 'settings'],
    loadConfigTemplate: ['shell', 'settings'],
    deleteConfigTemplate: ['shell', 'settings'],
    openQuickCompare: ['shell', 'compare'],
    generateDupontTemplate: ['shell', 'compare'],
    generatePeerCompareTemplate: ['shell', 'compare'],
    generateTrendTemplate: ['shell', 'compare'],
    exportCompareExcel: ['shell', 'compare'],
    switchToChartTab: ['shell', 'chart'],
    exportChartPng: ['shell', 'chart'],
  };

  const loadedGroups = new Set();
  const loadingGroups = new Map();

  const loadFragment = async path => {
    const resp = await fetch(path, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`片段加载失败: ${path}`);
    return resp.text();
  };

  const loadScript = src => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = withVersion(`js/${src}`);
    el.onload = resolve;
    el.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(el);
  });

  async function ensureGroup(groupName) {
    if (loadedGroups.has(groupName)) return;
    if (loadingGroups.has(groupName)) return loadingGroups.get(groupName);

    const scripts = groupScripts[groupName];
    if (!scripts) throw new Error(`未知分组: ${groupName}`);

    const task = (async () => {
      for (const src of scripts) {
        await loadScript(src);
      }
      loadedGroups.add(groupName);
    })();

    loadingGroups.set(groupName, task);
    try {
      await task;
    } finally {
      loadingGroups.delete(groupName);
    }
  }

  window.__loadFeatureGroup = ensureGroup;

  window.loadGroupThenRun = function(groupName, fnName) {
    if (typeof window[fnName] === 'function') { window[fnName](); return; }
    ensureGroup(groupName).then(function() {
      if (typeof window[fnName] === 'function') window[fnName]();
      else showBottomToast('功能加载失败，请刷新重试');
    });
  };

  async function mountFragments() {
    const parts = await Promise.all(fragmentPaths.map(loadFragment));
    document.body.innerHTML = parts.join('\n');
  }

  function installLazyFn(name, groups) {
    const lazyFn = async function(...args) {
      for (const group of groups) {
        await ensureGroup(group);
      }
      const realFn = window[name];
      if (typeof realFn !== 'function' || realFn === lazyFn) return undefined;
      return realFn.apply(this, args);
    };
    window[name] = lazyFn;
  }

  for (const [name, groups] of Object.entries(fnGroups)) {
    installLazyFn(name, groups);
  }

  (async () => {
    try {
      await mountFragments();
      /* 初始化顶部广告横幅：微信号复制 + 功能轮播 */
      initPromoBanner();
      await ensureGroup('shell');
    } catch (err) {
      console.error(err);
    }
  })();

  function initPromoBanner() {
    /* 微信号复制 */
    var cta = document.getElementById('promoCta');
    if (cta) {
      cta.addEventListener('click', function(){
        if (navigator.clipboard) {
          navigator.clipboard.writeText('zhh940417');
          var orig = this.innerHTML;
          this.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 已复制';
          this.classList.add('copied');
          var self = this;
          setTimeout(function(){ self.innerHTML = orig; self.classList.remove('copied'); }, 2000);
        }
      });
    }
    /* 功能项动态轮播（淡入淡出 + 上移） */
    var features = [
      '多板块非标准审计报告获取',
      '批量公司财务数据对比分析',
      '自定义财务指标计算与监控',
      '历史数据多年趋势分析',
      '特定行业板块批量采集',
      'ESG / 社会责任报告采集',
      '财务数据可视化图表报告',
      '定期自动采集 + 推送通知',
      '招股书 / 法律意见书提取',
      '股东名册与股权结构分析',
      '关联交易与担保数据采集',
      '自定义 Excel 模板批量生成'
    ];
    var el = document.getElementById('promoRotate');
    if (el) {
      var idx = 0;
      var promoTimer = setInterval(function(){
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        setTimeout(function(){
          idx = (idx + 1) % features.length;
          el.textContent = features[idx];
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 400);
      }, 3000);
      var closeBtn = document.querySelector('#topAdBanner .promo-banner__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() { clearInterval(promoTimer); });
      }
    }
  }
})();

function closePromoBanner(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
  try { localStorage.setItem('promo_closed_' + id, Date.now().toString()); } catch(e) {}
}
(function() {
  var ids = ['topAdBanner'];
  var now = Date.now();
  var DAY = 86400000;
  ids.forEach(function(id) {
    try {
      var closed = parseInt(localStorage.getItem('promo_closed_' + id) || '0');
      if (closed && (now - closed) < DAY) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
    } catch(e) {}
  });
})();
