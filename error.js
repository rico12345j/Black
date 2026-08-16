// ============================================================
// ===== ERROR MIDDLEWARE — معالجة الأخطاء =====
// ============================================================

const { logger } = require('./logger');

// ===== معالج الأخطاء العام =====
const errorHandler = (err, req, res, next) => {
    // تسجيل الخطأ
    logger.error(`❌ خطأ: ${err.message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        user: req.user ? req.user.username : 'غير مسجل',
        stack: err.stack,
        body: req.body,
        query: req.query,
        params: req.params
    });

    // أخطاء قاعدة البيانات (MongoDB)
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(409).json({
                success: false,
                message: `هذا ${field} موجود بالفعل`,
                field: field
            });
        }
        if (err.code === 121) {
            return res.status(400).json({
                success: false,
                message: 'البيانات غير صالحة (خطأ في التحقق)'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'حدث خطأ في قاعدة البيانات'
        });
    }

    // أخطاء التحقق (Validation)
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        return res.status(400).json({
            success: false,
            message: 'بيانات غير صالحة',
            errors
        });
    }

    // أخطاء المصادقة (JWT)
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'الرمز غير صالح'
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'انتهت صلاحية الرمز'
        });
    }

    // أخطاء Cast (تحويل المعرف)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'المعرف غير صالح'
        });
    }

    // أخطاء Multer (رفع الملفات)
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'حجم الملف كبير جداً'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'عدد الملفات كبير جداً'
            });
        }
        return res.status(400).json({
            success: false,
            message: `خطأ في رفع الملف: ${err.message}`
        });
    }

    // أخطاء مخصصة
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err.errors && { errors: err.errors })
        });
    }

    // أخطاء HTTP
    if (err.status) {
        return res.status(err.status).json({
            success: false,
            message: err.message
        });
    }

    // أخطاء عامة
    console.error('❌ خطأ غير متوقع:', err);
    res.status(500).json({
        success: false,
        message: 'حدث خطأ داخلي في الخادم'
    });
};

// ===== 404 غير موجود =====
const notFound = (req, res) => {
    logger.warning(`⚠️ 404: ${req.method} ${req.path} - ${req.ip}`);
    
    // إذا كان طلب API
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'المسار غير موجود'
        });
    }
    
    // إذا كان طلب صفحة
    res.status(404).sendFile('404.html', { root: '../frontend' }, (err) => {
        if (err) {
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>404 - غير موجود</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="font-size: 48px;">🐙 404</h1>
                    <p>الصفحة التي تبحث عنها غير موجودة</p>
                    <a href="/">العودة إلى الرئيسية</a>
                </body>
                </html>
            `);
        }
    });
};

// ===== معالج الأخطاء غير المتوقعة =====
const unhandledError = (err, req, res, next) => {
    logger.error('❌ خطأ غير متوقع:', err);
    res.status(500).json({
        success: false,
        message: 'حدث خطأ غير متوقع'
    });
};

// ===== تصدير =====
module.exports = {
    errorHandler,
    notFound,
    unhandledError
};