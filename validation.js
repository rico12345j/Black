// ============================================================
// ===== VALIDATION MIDDLEWARE — التحقق من البيانات =====
// ============================================================

const { body, param, query, validationResult } = require('express-validator');
const { logger } = require('./logger');

// ===== دالة معالجة أخطاء التحقق =====
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(e => ({
            field: e.path || e.param,
            message: e.msg
        }));
        
        logger.warning('⚠️ فشل التحقق من البيانات:', { errors: errorMessages, path: req.path });
        
        return res.status(400).json({
            success: false,
            message: 'بيانات غير صالحة',
            errors: errorMessages
        });
    }
    next();
};

// ===== التحقق من التسجيل =====
const validateRegistration = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 39 })
        .withMessage('اسم المستخدم يجب أن يكون بين 3 و 39 حرفاً')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('اسم المستخدم يحتوي على أحرف غير مسموحة')
        .escape(),
    body('email')
        .trim()
        .isEmail()
        .withMessage('البريد الإلكتروني غير صالح')
        .normalizeEmail()
        .escape(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>\/?])?/)
        .withMessage('كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم'),
    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('الاسم يجب أن يكون 100 حرف كحد أقصى')
        .escape(),
    handleValidationErrors
];

// ===== التحقق من تسجيل الدخول =====
const validateLogin = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('اسم المستخدم مطلوب')
        .escape(),
    body('password')
        .notEmpty()
        .withMessage('كلمة المرور مطلوبة'),
    handleValidationErrors
];

// ===== التحقق من إنشاء مستودع =====
const validateRepository = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('اسم المستودع مطلوب')
        .matches(/^[a-zA-Z0-9_.-]+$/)
        .withMessage('اسم المستودع يحتوي على أحرف غير مسموحة')
        .escape(),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('الوصف يجب أن يكون 500 حرف كحد أقصى')
        .escape(),
    body('isPublic')
        .optional()
        .isBoolean()
        .withMessage('isPublic يجب أن يكون قيمة منطقية'),
    handleValidationErrors
];

// ===== التحقق من إنشاء قضية =====
const validateIssue = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('عنوان القضية مطلوب')
        .isLength({ max: 255 })
        .withMessage('العنوان يجب أن يكون 255 حرف كحد أقصى')
        .escape(),
    body('body')
        .trim()
        .notEmpty()
        .withMessage('وصف القضية مطلوب')
        .isLength({ max: 10000 })
        .withMessage('الوصف يجب أن يكون 10000 حرف كحد أقصى')
        .escape(),
    body('repositoryId')
        .notEmpty()
        .withMessage('معرف المستودع مطلوب')
        .isMongoId()
        .withMessage('معرف المستودع غير صالح'),
    body('assignees')
        .optional()
        .isArray()
        .withMessage('المعينين يجب أن يكونوا مصفوفة'),
    body('labels')
        .optional()
        .isArray()
        .withMessage('الملصقات يجب أن تكون مصفوفة'),
    handleValidationErrors
];

// ===== التحقق من إنشاء طلب سحب =====
const validatePullRequest = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('عنوان طلب السحب مطلوب')
        .isLength({ max: 255 })
        .withMessage('العنوان يجب أن يكون 255 حرف كحد أقصى')
        .escape(),
    body('repositoryId')
        .notEmpty()
        .withMessage('معرف المستودع مطلوب')
        .isMongoId()
        .withMessage('معرف المستودع غير صالح'),
    body('baseBranch')
        .trim()
        .notEmpty()
        .withMessage('الفرع الأساسي مطلوب')
        .escape(),
    body('headBranch')
        .trim()
        .notEmpty()
        .withMessage('الفرع المصدر مطلوب')
        .escape(),
    body('draft')
        .optional()
        .isBoolean()
        .withMessage('مسودة يجب أن تكون قيمة منطقية'),
    handleValidationErrors
];

// ===== التحقق من التعليق =====
const validateComment = [
    body('body')
        .trim()
        .notEmpty()
        .withMessage('نص التعليق مطلوب')
        .isLength({ max: 10000 })
        .withMessage('التعليق يجب أن يكون 10000 حرف كحد أقصى')
        .escape(),
    handleValidationErrors
];

// ===== التحقق من المعرف =====
const validateId = [
    param('id')
        .isMongoId()
        .withMessage('المعرف غير صالح'),
    handleValidationErrors
];

// ===== التحقق من البحث =====
const validateSearch = [
    query('q')
        .trim()
        .notEmpty()
        .withMessage('نص البحث مطلوب')
        .isLength({ min: 2 })
        .withMessage('نص البحث يجب أن يكون حرفين على الأقل')
        .escape(),
    query('type')
        .optional()
        .isIn(['all', 'repositories', 'users', 'issues', 'pullRequests'])
        .withMessage('نوع البحث غير صالح'),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('الحد يجب أن يكون بين 1 و 100'),
    handleValidationErrors
];

// ===== التحقق من تحديث الملف الشخصي =====
const validateProfileUpdate = [
    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('الاسم يجب أن يكون 100 حرف كحد أقصى')
        .escape(),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('السيرة الذاتية يجب أن تكون 500 حرف كحد أقصى')
        .escape(),
    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('الموقع يجب أن يكون 100 حرف كحد أقصى')
        .escape(),
    body('website')
        .optional()
        .trim()
        .isURL()
        .withMessage('الرابط غير صالح')
        .escape(),
    body('company')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('الشركة يجب أن تكون 100 حرف كحد أقصى')
        .escape(),
    handleValidationErrors
];

// ===== تصدير =====
module.exports = {
    handleValidationErrors,
    validateRegistration,
    validateLogin,
    validateRepository,
    validateIssue,
    validatePullRequest,
    validateComment,
    validateId,
    validateSearch,
    validateProfileUpdate
};