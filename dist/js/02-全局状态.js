// ==================== 全局状态 ====================
let isRunning = false;
let shouldStop = false;
let logCountNum = 0;
let fileIdCounter = 0;

// 全局文件存储
// type: 'excel' | 'pdf' | 'pdf-link'
// category: 'reports' | 'pdfs'
let collectedFiles = [];

// 请求缓存（用于请求去重）
const requestCache = new Map();

// PDF blobUrl 追踪（用于内存释放）
let currentPdfBlobUrl = null;

// 当前预览的 workbook 和 sheet 信息（用于键盘切换）
let currentPreviewState = null;

// 自动保存 debounce 定时器
let autoSaveTimer = null;

// 失败任务记录（用于错误恢复）
let failedTasks = [];
