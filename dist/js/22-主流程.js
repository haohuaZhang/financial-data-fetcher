// ==================== 主流程 ====================
async function startFetching() {
  if (isRunning) return;

  // 检查暗号是否过期
  if (checkSecretExpiry()) return;

  const config = getConfig();
  // 保存配置到localStorage
  saveConfig();

  // 散修模式提示
  if (!isMember) {
    addLog(t('log-guest-mode'), 'warn');
  }
  
  if (config.companies.length === 0) {
    addLog(t('log-no-company'), 'error');
    return;
  }
  if (config.years.length === 0) {
    addLog(t('log-no-year'), 'error');
    return;
  }
  if (config.targetTables.length === 0) {
    addLog(t('log-no-table'), 'error');
    return;
  }
  if (config.reportTypes.length === 0) {
    addLog(t('log-no-report'), 'error');
    return;
  }

  isRunning = true;
  shouldStop = false;
  failedTasks = [];
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  // BUG-D03: 添加loading状态
  btnStart.disabled = true;
  btnStart.innerHTML = '<span class="spinner-lg"></span> ' + t('log-starting');
  btnStop.disabled = false;
  btnStop.innerHTML = '<span>&#9632;</span> ' + t('btn-stop');

  // 初始化代理健康状态
  initProxyHealth();

  addLog(t('log-start'), 'info');
  addLog(`${t('log-companies')}: ${config.companies.join(', ')}`, 'info');
  addLog(`${t('log-years')}: ${config.years.join(', ')}`, 'info');
  addLog(`${t('log-report-types')}: ${config.reportTypes.map(rt => reportTypeNames[rt] || rt).join(', ')}`, 'info');
  addLog(`${t('log-target-tables')}: ${config.targetTables.join(', ')}`, 'info');
  addLog(`${t('log-need-pdf')}: ${config.needPdf ? t('log-yes') : t('log-no')}`, 'info');
  addLog(`${t('log-available-proxies')}: ${getAvailableProxies('text').length} / ${textProxies.length}`, 'info');
  addLog(`${t('log-available-proxies')}: ${getAvailableProxies('binary').length} / ${binaryProxies.length}`, 'info');

  initCompanyStatusList(config.companies);

  const totalTasks = config.companies.length * config.reportTypes.length;
  let completedTasks = 0;
  const allExcelData = {};

  try {
    for (const company of config.companies) {
      if (shouldStop) break;

      updateCompanyStatus(company, 'running', t('log-searching-stock'));
      setProgress(`${t('log-exploring')}: ${company}`, completedTasks, totalTasks);
      updateProgressSummary(`${t('log-searching-code')} ${company} ${t('log-stock-code-suffix')} (${completedTasks + 1}/${totalTasks})`);

      let stockCode;
      try {
        stockCode = await searchStockCode(company);
      } catch (e) {
        addLog(`${company} ${t('log-stock-code-fail')}: ${e.message}`, 'error');
        updateCompanyStatus(company, 'error', t('log-stock-code-fail'));
        completedTasks += config.reportTypes.length;
        setProgress(`${t('log-company-done')}: ${company}`, completedTasks, totalTasks);
        continue;
      }

      updateCompanyStatus(company, 'running', `${t('log-stock-code-found')}: ${stockCode}`);

      // 并行请求优化：门派弟子模式下，同一公司的不同功法等级可以并行采集
      if (isMember && config.reportTypes.length > 1) {
        addLog(`${t('log-parallel')} ${company}: ${t('log-parallel-suffix')} ${config.reportTypes.length} ${t('log-report-types-suffix')}`, 'info');
        const reportTypePromises = config.reportTypes.map(async (rt) => {
          if (shouldStop) return;
          const rtName = reportTypeNames[rt] || rt;
          const sheetKey = `${company}_${rtName}`;
          updateCompanyStatus(company, 'running', `${t('log-exploring')} ${rtName}...`);
          updateProgressSummary(`${t('log-exploring')}: ${company} ${rtName} (${completedTasks + config.reportTypes.indexOf(rt) + 1}/${totalTasks})`);

          try {
            const announcements = await getAnnouncementList(stockCode, rt, config.years);
            if (announcements.length === 0) {
              addLog(`${company} - ${rtName}: ${t('log-no-report-found')}`, 'warn');
              allExcelData[sheetKey] = {};
              return;
            }

            const mergedTables = {};
            for (const ann of announcements) {
              if (shouldStop) break;
              addLog(`${t('log-reading-report')}: ${ann.title}`, 'info');
              updateCompanyStatus(company, 'running', `${t('log-decrypting')}: ${ann.title.substring(0, 20)}...`);

              const tables = await fetchReportTables(ann.url, config.targetTables, config.nameLength, config.needPdf);
              const pdfUrlFromPage = tables['__pdfLink__'];
              delete tables['__pdfLink__'];

              for (const [tableName, tableRows] of Object.entries(tables)) {
                if (!mergedTables[tableName]) mergedTables[tableName] = [];
                if (tableRows && tableRows.length > 0) {
                  if (mergedTables[tableName].length === 0) {
                    mergedTables[tableName] = tableRows;
                  } else {
                    const lastRow = mergedTables[tableName][mergedTables[tableName].length - 1];
                    const firstNewRow = tableRows[0];
                    if (isSimilarRow(lastRow, firstNewRow)) {
                      mergedTables[tableName] = mergedTables[tableName].concat(tableRows.slice(1));
                    } else {
                      mergedTables[tableName] = mergedTables[tableName].concat([[], ...tableRows]);
                    }
                  }
                }
              }

              if (config.needPdf && pdfUrlFromPage) {
                try {
                  const pdfFilename = `${company}_${ann.year}_${rtName}_${Date.now()}.pdf`;
                  const downloaded = await downloadPdfViaProxy(pdfUrlFromPage, pdfFilename, company, ann.year, rtName, ann.title);
                  if (!downloaded) savePdfLink(pdfUrlFromPage, pdfFilename, company, ann.year, rtName, ann.title);
                } catch (e) { addLog(`${t('log-pdf-exception')}: ${e.message}`, 'warn'); }
              } else if (config.needPdf && !pdfUrlFromPage) {
                addLog(t('log-pdf-no-link'), 'warn');
              }

              if (!shouldStop) {
                addLog(t('log-delay'), 'debug');
                await randomDelay(3000, 8000);
              }
            }
            allExcelData[sheetKey] = mergedTables;
          } catch (e) {
            addLog(`${company} - ${rtName} ${t('log-error-progress')}: ${e.message}`, 'error');
            allExcelData[sheetKey] = {};
            failedTasks.push({ company, reportType: rt, years: config.years, error: e.message });
          }
        });

        await Promise.all(reportTypePromises);
        completedTasks += config.reportTypes.length;
        setProgress(`${t('log-exploring')}: ${company}`, completedTasks, totalTasks);
      } else {
        // 散修模式或单功法等级：顺序处理
        for (const rt of config.reportTypes) {
          if (shouldStop) break;

          const rtName = reportTypeNames[rt] || rt;
          const sheetKey = `${company}_${rtName}`;
          updateCompanyStatus(company, 'running', `${t('log-exploring')} ${rtName}...`);
          updateProgressSummary(`${t('log-exploring')}: ${company} ${rtName} (${completedTasks + 1}/${totalTasks})`);

          try {
            const announcements = await getAnnouncementList(stockCode, rt, config.years);
            if (announcements.length === 0) {
              addLog(`${company} - ${rtName}: ${t('log-no-report-found')}`, 'warn');
              allExcelData[sheetKey] = {};
              completedTasks++;
              setProgress(`${t('log-exploring')}: ${company}`, completedTasks, totalTasks);
              continue;
            }

            const mergedTables = {};

            for (const ann of announcements) {
              if (shouldStop) break;

              addLog(`${t('log-reading-report')}: ${ann.title}`, 'info');
              updateCompanyStatus(company, 'running', `${t('log-decrypting')}: ${ann.title.substring(0, 20)}...`);

              const tables = await fetchReportTables(ann.url, config.targetTables, config.nameLength, config.needPdf);

              const pdfUrlFromPage = tables['__pdfLink__'];
              delete tables['__pdfLink__'];

              for (const [tableName, tableRows] of Object.entries(tables)) {
                if (!mergedTables[tableName]) {
                  mergedTables[tableName] = [];
                }
                if (tableRows && tableRows.length > 0) {
                  if (mergedTables[tableName].length === 0) {
                    mergedTables[tableName] = tableRows;
                  } else {
                    const lastRow = mergedTables[tableName][mergedTables[tableName].length - 1];
                    const firstNewRow = tableRows[0];
                    if (isSimilarRow(lastRow, firstNewRow)) {
                      mergedTables[tableName] = mergedTables[tableName].concat(tableRows.slice(1));
                    } else {
                      mergedTables[tableName] = mergedTables[tableName].concat([[], ...tableRows]);
                    }
                  }
                }
              }

              if (config.needPdf && pdfUrlFromPage) {
                try {
                  const pdfFilename = `${company}_${ann.year}_${rtName}_${Date.now()}.pdf`;
                  const downloaded = await downloadPdfViaProxy(pdfUrlFromPage, pdfFilename, company, ann.year, rtName, ann.title);
                  if (!downloaded) {
                    savePdfLink(pdfUrlFromPage, pdfFilename, company, ann.year, rtName, ann.title);
                  }
                } catch (e) {
                  addLog(`${t('log-pdf-exception')}: ${e.message}`, 'warn');
                }
              } else if (config.needPdf && !pdfUrlFromPage) {
                addLog(t('log-pdf-no-link'), 'warn');
              }

              if (!shouldStop) {
                addLog(t('log-delay'), 'debug');
                await randomDelay(3000, 8000);
              }
            }

            allExcelData[sheetKey] = mergedTables;

          } catch (e) {
            addLog(`${company} - ${rtName} ${t('log-error-progress')}: ${e.message}`, 'error');
            allExcelData[sheetKey] = {};
            failedTasks.push({ company, reportType: rt, years: config.years, error: e.message });
          }

          completedTasks++;
          setProgress(`${t('log-exploring')}: ${company}`, completedTasks, totalTasks);

          if (!shouldStop) {
            await randomDelay(3000, 8000);
          }
        }
      }

      updateCompanyStatus(company, 'success', t('log-company-done'));
      if (!shouldStop) {
        await randomDelay(5000, 10000);
      }
    }

    // 生成Excel
    if (Object.keys(allExcelData).length > 0) {
      setProgress(t('log-excel-gen'), completedTasks, totalTasks);
      window.__latestExcelData = allExcelData;
      generateExcel(allExcelData);
      if (typeof refreshFinanceInsights === 'function') refreshFinanceInsights();
    }

    // 统计结果
    const excelCount = collectedFiles.filter(f => f.type === 'excel').length;
    const pdfCount = collectedFiles.filter(f => f.type === 'pdf').length;
    const pdfLinkCount = collectedFiles.filter(f => f.type === 'pdf-link').length;

    addLog(t('log-done'), shouldStop ? 'warn' : 'success');
    addLog(`${t('log-result-summary')}: ${excelCount} ${t('log-excel-files')}, ${pdfCount} ${t('log-pdf-files')}, ${pdfLinkCount} ${t('log-pdf-link-files')}`, 'info');

    // 错误恢复：输出失败任务摘要
    if (failedTasks.length > 0) {
      addLog(`${t('log-failed-tasks')} ${failedTasks.length} ${t('log-failed-tasks-suffix')}:`, 'warn');
      failedTasks.forEach((task, i) => {
        addLog(`  ${i + 1}. ${task.company} - ${reportTypeNames[task.reportType] || task.reportType}: ${task.error}`, 'error');
      });
      addLog(t('log-retry-hint'), 'info');
    }

    if (pdfLinkCount > 0) {
      addLog(t('log-pdf-link-hint'), 'info');
    }

    if (shouldStop) {
      addLog(t('log-stopped-msg'), 'warn');
      setProgress(t('log-stopped-progress'), completedTasks, totalTasks);
    } else {
      setProgress(t('log-all-done'), completedTasks, totalTasks);
    }

  } catch (e) {
    addLog(`${t('log-error-occurred')}: ${e.message}`, 'error');
    setProgress(t('log-error-progress'), completedTasks, totalTasks);
  }

  isRunning = false;
  if (typeof clearRequestCache === 'function') clearRequestCache();
  // BUG-D03: 恢复开始按钮状态
  btnStart.disabled = false;
  btnStart.innerHTML = '<span>&#9654;</span> ' + t('btn-start');
  // BUG-D04: 恢复停止按钮状态
  btnStop.disabled = true;
  btnStop.innerHTML = '<span>&#9632;</span> ' + t('btn-stop');

  // 隐藏进度摘要
  const summary = document.getElementById('progressSummary');
  if (summary) summary.classList.remove('active');
}

function stopFetching() {
  shouldStop = true;
  addLog(t('log-stopping'), 'warn');
  // BUG-D04: 显示正在停止状态
  const btnStop = document.getElementById('btnStop');
  btnStop.disabled = true;
  btnStop.innerHTML = '<span class="spinner-lg"></span> ' + t('log-stopping-btn');
}
