// ==================== Excel 生成 ====================
function generateExcel(allData) {
  addLog(t('log-excel-gen'), 'info');
  const wb = XLSX.utils.book_new();

  for (const [sheetName, sheetData] of Object.entries(allData)) {
    const rows = [];
    for (const [tableName, tableRows] of Object.entries(sheetData)) {
      rows.push([tableName]);
      if (tableRows && tableRows.length > 0) {
        for (const row of tableRows) {
          rows.push(row);
        }
      }
      rows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 自动调整列宽
    if (rows.length > 0) {
      const maxCols = Math.max(...rows.map(r => r.length));
      const colWidths = [];
      for (let c = 0; c < maxCols; c++) {
        let maxLen = 10;
        for (const row of rows) {
          if (row[c] !== undefined) {
            const len = String(row[c]).length;
            if (len > maxLen) maxLen = len;
          }
        }
        colWidths.push({ wch: Math.min(maxLen + 4, 60) });
      }
      ws['!cols'] = colWidths;
    }

    var baseName = sheetName.substring(0, 28);
    var finalName = baseName;
    var nameCount = 0;
    while (wb.SheetNames.indexOf(finalName) !== -1) {
      nameCount++;
      finalName = baseName.substring(0, 28 - String(nameCount).length) + '_' + nameCount;
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const filename = `${t('excel-filename')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const fileObj = {
    id: ++fileIdCounter,
    name: filename,
    type: 'excel',
    category: 'reports',
    blob: blob,
    url: null,
    size: blob.size,
    timestamp: new Date().toISOString(),
    _sheetNames: Object.keys(allData || {}),
    _tableNames: Object.entries(allData || {}).flatMap(([, sheetData]) => Object.keys(sheetData || {}))
  };
  collectedFiles.push(fileObj);
  updateFileCount();
  window.__latestExcelData = allData;
  if (typeof refreshFinanceInsights === 'function') refreshFinanceInsights();
  addLog(`${t('log-excel-done')}: ${filename} (${formatFileSize(blob.size)})`, 'success');
  return filename;
}
