(() => {
  const assetBase = window.__APP_ASSET_BASE__ || '.';
  const fragmentPaths = [
    `${assetBase}/fragments/decorations.fragment`,
    `${assetBase}/fragments/header.fragment`,
    `${assetBase}/fragments/left-panel.fragment`,
    `${assetBase}/fragments/right-panel.fragment`,
    `${assetBase}/fragments/modals.fragment`,
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
    ],
    settings: [
      '26-测试自定义代理.js',
      '27-配置模板功能.js',
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
    el.src = `${assetBase}/js/${src}`;
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
      await ensureGroup('shell');
    } catch (err) {
      console.error(err);
    }
  })();
})();
