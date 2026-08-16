// ============================================================
// ===== REPOS ROUTES — مسارات المستودعات =====
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Repository = require('../models/Repository');
const User = require('../models/User');
const Issue = require('../models/Issue');
const PullRequest = require('../models/PullRequest');
const Comment = require('../models/Comment');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const { validateRepository } = require('../middleware/validation');

// ===== إعدادات رفع الملفات =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مدعوم'), false);
        }
    }
});

// ===== الحصول على قائمة المستودعات =====
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 30, sort = 'createdAt', order = 'desc', language, topic } = req.query;
        const skip = (page - 1) * limit;
        const sortOrder = order === 'asc' ? 1 : -1;
        
        const query = {
            $or: [
                { owner: req.user._id },
                { 'collaborators.user': req.user._id },
                { isPublic: true }
            ]
        };
        if (language) query.language = language;
        if (topic) query.topics = topic;
        
        const repos = await Repository.find(query)
            .sort({ [sort]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('owner', 'username name avatarUrl');
        
        const total = await Repository.countDocuments(query);
        
        res.json({
            success: true,
            repos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على المستودعات:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب المستودعات'
        });
    }
});

// ===== إنشاء مستودع جديد =====
router.post('/', authMiddleware, validateRepository, async (req, res) => {
    try {
        const { name, description, isPublic = true, isTemplate = false, license = 'MIT' } = req.body;
        
        const existingRepo = await Repository.findOne({
            name,
            owner: req.user._id
        });
        
        if (existingRepo) {
            return res.status(409).json({
                success: false,
                message: 'يوجد مستودع بنفس الاسم بالفعل'
            });
        }
        
        const repo = new Repository({
            name,
            description: description || '',
            owner: req.user._id,
            isPublic,
            isTemplate,
            license,
            defaultBranch: 'main',
            branches: [{ name: 'main', protected: false }]
        });
        
        await repo.save();
        
        logger.info(`✅ تم إنشاء مستودع: ${repo.name} بواسطة ${req.user.username}`);
        
        res.status(201).json({
            success: true,
            repo: repo.toJSON(),
            message: 'تم إنشاء المستودع بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل إنشاء المستودع:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إنشاء المستودع'
        });
    }
});

// ===== الحصول على مستودع =====
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id)
            .populate('owner', 'username name avatarUrl')
            .populate('collaborators.user', 'username name avatarUrl')
            .populate('stargazers', 'username name avatarUrl')
            .populate('watchersList', 'username name avatarUrl');
        
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        if (!repo.isPublic && !repo.isOwner(req.user._id) && !repo.isCollaborator(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لعرض هذا المستودع'
            });
        }
        
        res.json({
            success: true,
            repo: repo.toJSON()
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على المستودع:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب المستودع'
        });
    }
});

// ===== تحديث مستودع =====
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { description, isPublic, isTemplate, isArchived, license, topics, defaultBranch } = req.body;
        
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        if (!repo.isOwner(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لتعديل هذا المستودع'
            });
        }
        
        if (description !== undefined) repo.description = description;
        if (isPublic !== undefined) repo.isPublic = isPublic;
        if (isTemplate !== undefined) repo.isTemplate = isTemplate;
        if (isArchived !== undefined) repo.isArchived = isArchived;
        if (license !== undefined) repo.license = license;
        if (topics !== undefined) repo.topics = topics;
        if (defaultBranch !== undefined) repo.defaultBranch = defaultBranch;
        
        repo.updatedAt = Date.now();
        await repo.save();
        
        logger.info(`✅ تم تحديث المستودع: ${repo.name}`);
        
        res.json({
            success: true,
            repo: repo.toJSON(),
            message: 'تم تحديث المستودع بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل تحديث المستودع:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تحديث المستودع'
        });
    }
});

// ===== حذف مستودع =====
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        if (!repo.isOwner(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لحذف هذا المستودع'
            });
        }
        
        await Repository.findByIdAndDelete(req.params.id);
        await Issue.deleteMany({ repository: req.params.id });
        await PullRequest.deleteMany({ repository: req.params.id });
        await Comment.deleteMany({ repository: req.params.id });
        
        logger.info(`✅ تم حذف المستودع: ${repo.name}`);
        
        res.json({
            success: true,
            message: 'تم حذف المستودع بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل حذف المستودع:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء حذف المستودع'
        });
    }
});

// ===== إضافة نجمة =====
router.post('/:id/star', authMiddleware, async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        await repo.addStar(req.user._id);
        
        res.json({
            success: true,
            message: 'تم إضافة نجمة للمستودع'
        });
    } catch (error) {
        logger.error('❌ فشل إضافة نجمة:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إضافة النجمة'
        });
    }
});

// ===== إزالة نجمة =====
router.delete('/:id/star', authMiddleware, async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        await repo.removeStar(req.user._id);
        
        res.json({
            success: true,
            message: 'تم إزالة النجمة من المستودع'
        });
    } catch (error) {
        logger.error('❌ فشل إزالة نجمة:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إزالة النجمة'
        });
    }
});

// ===== متابعة المستودع =====
router.post('/:id/watch', authMiddleware, async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        await repo.addWatcher(req.user._id);
        
        res.json({
            success: true,
            message: 'تم متابعة المستودع'
        });
    } catch (error) {
        logger.error('❌ فشل متابعة المستودع:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء متابعة المستودع'
        });
    }
});

// ===== إلغاء متابعة المستودع =====
router.delete('/:id/watch', authMiddleware, async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        await repo.removeWatcher(req.user._id);
        
        res.json({
            success: true,
            message: 'تم إلغاء متابعة المستودع'
        });
    } catch (error) {
        logger.error('❌ فشل إلغاء متابعة المستودع:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إلغاء المتابعة'
        });
    }
});

// ===== رفع ملف =====
router.post('/:id/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const repo = await Repository.findById(req.params.id);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        if (!repo.isOwner(req.user._id) && !repo.isCollaborator(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لرفع الملفات'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'لم يتم رفع أي ملف'
            });
        }
        
        res.json({
            success: true,
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                path: req.file.path
            },
            message: 'تم رفع الملف بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل رفع الملف:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء رفع الملف'
        });
    }
});

module.exports = router;