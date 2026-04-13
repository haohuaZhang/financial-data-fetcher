// ==================== 配置解析 ====================
function getRawConfig() {
  // BUG-A04: 获取原始配置（不应用散修阉割），用于保存
  const splitCommaList = value => value.split(/[,\n，]+/).map(s => s.trim()).filter(Boolean);
  let companies = splitCommaList(document.getElementById('companies').value);
  let years = document.getElementById('years').value.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  const targetTables = splitCommaList(document.getElementById('targetTables').value);
  const reportTypes = [];
  document.querySelectorAll('#reportTypes .checkbox-item.active').forEach(item => {
    reportTypes.push(item.dataset.value);
  });
  const needPdf = document.getElementById('needPdfSwitch').classList.contains('active');
  const nameLength = parseInt(document.getElementById('nameLength').value) || 100;
  const customProxies = document.getElementById('customProxies').value.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const useCustomProxy = document.getElementById('useCustomProxySwitch').classList.contains('active');

  return { companies, years, targetTables, reportTypes, needPdf, nameLength, customProxies, useCustomProxy };
}

function getConfig() {
  // 检查暗号是否过期
  if (checkSecretExpiry()) return getRawConfig();

  const config = getRawConfig();

  // 散修模式阉割：只处理第一个公司、第一个年份
  if (!isMember) {
    if (config.companies.length > 1) config.companies = [config.companies[0]];
    if (config.years.length > 1) config.years = [config.years[0]];
    if (config.reportTypes.length > 1) config.reportTypes.length = 1;
  }

  return config;
}
