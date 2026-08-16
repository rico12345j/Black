// ============================================================
// ===== LOGGER MIDDLEWARE — تسجيل العمليات =====
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// ===== إنشاء مجلد السجلات =====
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// ===== مستويات التسجيل =====
const LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const LEVEL_NAMES = {
    0: 'ERROR',
    1: 'WARN',
    2: 'INFO',
    3: 'DEBUG'
};

// ===== إعدادات السجلات =====
const config = {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: parseInt(process.env.LOG_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.LOG_BACKUP_COUNT) || 5,
    format: process.env.LOG_FORMAT || 'json'
};

// ===== كتابة السجل =====
const writeLog = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level: LEVEL_NAMES[level],
        message,
        pid: process.pid,
        hostname: os.hostname(),
        ...data
    };

    // تنسيق السجل
    let logLine;
    if (config.format === 'json') {
        logLine = JSON.stringify(logEntry);
    } else {
        logLine = `[${timestamp}] [${LEVEL_NAMES[level]}] ${message}`;
        if (Object.keys(data).length > 0) {
            logLine += ` ${JSON.stringify(data)}`;
        }
    }

    // كتابة إلى الملف
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `${date}.log`);
    
    // تدوير الملفات
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > config.maxSize) {
        rotateLogs(logFile);
    }

    fs.appendFileSync(logFile, logLine + '\n');

    // كتابة إلى الكونسول في وضع التطوير
    if (process.env.NODE_ENV !== 'production') {
        const colors = {
            0: '\x1b[31m', // RED
            1: '\x1b[33m', // YELLOW
            2: '\x1b[32m', // GREEN
            3: '\x1b[36m'  // CYAN
        };
        console.log(`${colors[level] || ''}${logLine}\x1b[0m`);
    }
};

// ===== تدوير السجلات =====
const rotateLogs = (logFile) => {
    try {
        const files = fs.readdirSync(logDir)
            .filter(f => f.startsWith(path.basename(logFile, '.log')))
            .sort();
        
        // حذف أقدم الملفات
        while (files.length >= config.maxFiles) {
            const oldFile = files.shift();
            fs.unlinkSync(path.join(logDir, oldFile));
        }

        // إعادة تسمية الملف الحالي
        const timestamp = Date.now();
        const newName = path.join(logDir, `${path.basename(logFile, '.log')}.${timestamp}.log`);
        fs.renameSync(logFile, newName);
    } catch (error) {
        console.error('❌ فشل تدوير السجلات:', error);
    }
};

// ===== دوال التسجيل =====
const logError = (message, data = {}) => writeLog(LEVELS.ERROR, message, data);
const logWarning = (message, data = {}) => writeLog(LEVELS.WARN, message, data);
const logInfo = (message, data = {}) => writeLog(LEVELS.INFO, message, data);
const logDebug = (message, data = {}) => writeLog(LEVELS.DEBUG, message, data);

// ===== مسجل الطلبات =====
const logger = (req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // إضافة معرف الطلب
    req.requestId = requestId;
    
    // تسجيل بداية الطلب (Debug)
    logDebug(`📥 ${req.method} ${req.path}`, {
        requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        query: req.query,
        params: req.params
    });

    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? LEVELS.ERROR : LEVELS.INFO;
        
        writeLog(level, `📤 ${req.method} ${req.path} - ${res.statusCode}`, {
            requestId,
            status: res.statusCode,
            duration: `${duration}ms`,
            user: req.user ? req.user.username : 'غير مسجل',
            ip: req.ip
        });
    });

    next();
};

// ===== الحصول على إحصائيات السجلات =====
const getLogStats = () => {
    try {
        const files = fs.readdirSync(logDir);
        const stats = {
            totalSize: 0,
            fileCount: 0,
            files: []
        };

        for (const file of files) {
            if (file.endsWith('.log')) {
                const filePath = path.join(logDir, file);
                const stat = fs.statSync(filePath);
                stats.totalSize += stat.size;
                stats.fileCount++;
                stats.files.push({
                    name: file,
                    size: stat.size,
                    modified: stat.mtime
                });
            }
        }

        return stats;
    } catch (error) {
        return { error: 'فشل الحصول على إحصائيات السجلات' };
    }
};

// ===== مسح السجلات =====
const clearLogs = () => {
    try {
        const files = fs.readdirSync(logDir);
        for (const file of files) {
            if (file.endsWith('.log')) {
                fs.unlinkSync(path.join(logDir, file));
            }
        }
        return { success: true, message: 'تم مسح جميع السجلات' };
    } catch (error) {
        return { success: false, message: 'فشل مسح السجلات' };
    }
};

// ===== تصدير =====
module.exports = {
    logger,
    logError,
    logWarning,
    logInfo,
    logDebug,
    getLogStats,
    clearLogs,
    LEVELS,
    LEVEL_NAMES
};