// ============================================================
// ===== HELPERS — أدوات مساعدة =====
// ============================================================

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

// ===== إنشاء مجلد إذا لم يكن موجوداً =====
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    }
    return false;
};

// ===== حذف ملف =====
const deleteFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ فشل حذف الملف:', error);
        return false;
    }
};

// ===== حذف مجلد =====
const deleteDirectory = (dirPath) => {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ فشل حذف المجلد:', error);
        return false;
    }
};

// ===== نسخ ملف =====
const copyFile = (source, destination) => {
    try {
        ensureDirectoryExists(path.dirname(destination));
        fs.copyFileSync(source, destination);
        return true;
    } catch (error) {
        console.error('❌ فشل نسخ الملف:', error);
        return false;
    }
};

// ===== تنسيق الحجم =====
const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ===== تنسيق التاريخ =====
const formatDate = (date) => {
    if (!date) return 'غير محدد';
    const d = new Date(date);
    return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// ===== تنسيق التاريخ القصير =====
const formatDateShort = (date) => {
    if (!date) return 'غير محدد';
    const d = new Date(date);
    return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// ===== وقت نسبي =====
const timeAgo = (date) => {
    if (!date) return 'الآن';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        سنة: 31536000,
        شهر: 2592000,
        أسبوع: 604800,
        يوم: 86400,
        ساعة: 3600,
        دقيقة: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `منذ ${interval} ${unit}`;
        }
    }
    return 'الآن';
};

// ===== تنسيق الأرقام =====
const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

// ===== توليد معرف فريد =====
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// ===== التحقق من البريد الإلكتروني =====
const isValidEmail = (email) => {
    if (!email) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};

// ===== التحقق من الرابط =====
const isValidUrl = (url) => {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// ===== التحقق من اسم المستخدم =====
const isValidUsername = (username) => {
    if (!username) return false;
    return /^[a-zA-Z0-9_-]{3,39}$/.test(username);
};

// ===== استخراج النطاق من البريد الإلكتروني =====
const extractDomain = (email) => {
    if (!email) return null;
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : null;
};

// ===== تنظيف النص =====
const sanitizeText = (text) => {
    if (!text) return '';
    return text
        .trim()
        .replace(/<[^>]*>/g, '') // إزالة HTML
        .replace(/&[^;]+;/g, ''); // إزالة الكيانات
};

// ===== اختصار النص =====
const truncateText = (text, maxLength = 100, suffix = '...') => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + suffix;
};

// ===== تنفيذ أمر في النظام =====
const execCommand = async (command, options = {}) => {
    try {
        const { stdout, stderr } = await execAsync(command, options);
        return { success: true, stdout, stderr };
    } catch (error) {
        return { success: false, error: error.message, stderr: error.stderr };
    }
};

// ===== قراءة ملف JSON =====
const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return null;
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ فشل قراءة ملف JSON:', error);
        return null;
    }
};

// ===== كتابة ملف JSON =====
const writeJsonFile = (filePath, data) => {
    try {
        ensureDirectoryExists(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('❌ فشل كتابة ملف JSON:', error);
        return false;
    }
};

// ===== تصدير =====
module.exports = {
    ensureDirectoryExists,
    deleteFile,
    deleteDirectory,
    copyFile,
    formatSize,
    formatDate,
    formatDateShort,
    timeAgo,
    formatNumber,
    generateId,
    isValidEmail,
    isValidUrl,
    isValidUsername,
    extractDomain,
    sanitizeText,
    truncateText,
    execCommand,
    readJsonFile,
    writeJsonFile
};