// ============================================================
// ===== ISSUES ROUTES — مسارات القضايا =====
// ============================================================

const express = require('express');
const router = express.Router();

const Issue = require('../models/Issue');
const Repository = require('../models/Repository');
const Comment = require('../models/Comment');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const { validateIssue, validateComment } = require('../middleware/validation');

// ===== الحصول على قائمة القضايا =====
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { repoId, state = 'open', page = 1, limit = 30, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOrder = order === 'asc' ? 1 : -1;
        
        const filter = { state };
        if (repoId) filter.repository = repoId;
        
        const issues = await Issue.find(filter)
            .sort({ [sort]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'username name avatarUrl')
            .populate('assignees', 'username name avatarUrl')
            .populate('repository', 'name owner')
            .populate('labels');
        
        const total = await Issue.countDocuments(filter);
        
        res.json({
            success: true,
            issues,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على القضايا:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب القضايا'
        });
    }
});

// ===== إنشاء قضية جديدة =====
router.post('/', authMiddleware, validateIssue, async (req, res) => {
    try {
        const { repositoryId, title, body, assignees, labels, milestone } = req.body;
        
        const repo = await Repository.findById(repositoryId);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        // التحقق من الصلاحيات
        if (!repo.isPublic && !repo.isOwner(req.user._id) && !repo.isCollaborator(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لإنشاء قضايا'
            });
        }
        
        const number = await Issue.getNextNumber(repositoryId);
        
        const issue = new Issue({
            number,
            title,
            body,
            repository: repositoryId,
            author: req.user._id,
            assignees: assignees || [],
            labels: labels || [],
            milestone
        });
        
        await issue.save();
        
        // تحديث عدد القضايا في المستودع
        await Repository.findByIdAndUpdate(repositoryId, {
            $inc: { issues: 1 }
        });
        
        logger.info(`✅ تم إنشاء قضية #${number} في ${repo.name}`);
        
        res.status(201).json({
            success: true,
            issue,
            message: 'تم إنشاء القضية بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل إنشاء القضية:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إنشاء القضية'
        });
    }
});

// ===== الحصول على قضية =====
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const issue = await Issue.findById(req.params.id)
            .populate('author', 'username name avatarUrl')
            .populate('assignees', 'username name avatarUrl')
            .populate('repository', 'name owner')
            .populate('comments', 'author body createdAt replies')
            .populate({
                path: 'comments',
                populate: {
                    path: 'author',
                    select: 'username name avatarUrl'
                }
            });
        
        if (!issue) {
            return res.status(404).json({
                success: false,
                message: 'القضية غير موجودة'
            });
        }
        
        res.json({
            success: true,
            issue
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على القضية:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب القضية'
        });
    }
});

// ===== تحديث قضية =====
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, body, state, assignees, labels, milestone } = req.body;
        
        const issue = await Issue.findById(req.params.id);
        if (!issue) {
            return res.status(404).json({
                success: false,
                message: 'القضية غير موجودة'
            });
        }
        
        if (!issue.author.equals(req.user._id) && !issue.repository.owner.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لتعديل هذه القضية'
            });
        }
        
        if (title !== undefined) issue.title = title;
        if (body !== undefined) issue.body = body;
        if (state !== undefined) {
            if (state === 'closed') {
                await issue.close(req.user._id);
            } else if (state === 'open') {
                await issue.reopen();
            }
        }
        if (assignees !== undefined) issue.assignees = assignees;
        if (labels !== undefined) issue.labels = labels;
        if (milestone !== undefined) issue.milestone = milestone;
        
        issue.updatedAt = Date.now();
        await issue.save();
        
        logger.info(`✅ تم تحديث القضية #${issue.number}`);
        
        res.json({
            success: true,
            issue,
            message: 'تم تحديث القضية بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل تحديث القضية:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تحديث القضية'
        });
    }
});

// ===== حذف قضية =====
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const issue = await Issue.findById(req.params.id);
        if (!issue) {
            return res.status(404).json({
                success: false,
                message: 'القضية غير موجودة'
            });
        }
        
        if (!issue.author.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لحذف هذه القضية'
            });
        }
        
        await Issue.findByIdAndDelete(req.params.id);
        
        await Repository.findByIdAndUpdate(issue.repository, {
            $inc: { issues: -1 }
        });
        
        logger.info(`✅ تم حذف القضية #${issue.number}`);
        
        res.json({
            success: true,
            message: 'تم حذف القضية بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل حذف القضية:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء حذف القضية'
        });
    }
});

// ===== إضافة تعليق =====
router.post('/:id/comments', authMiddleware, validateComment, async (req, res) => {
    try {
        const { body } = req.body;
        
        const issue = await Issue.findById(req.params.id);
        if (!issue) {
            return res.status(404).json({
                success: false,
                message: 'القضية غير موجودة'
            });
        }
        
        const comment = new Comment({
            body,
            author: req.user._id,
            repository: issue.repository,
            issue: issue._id
        });
        
        await comment.save();
        await issue.addComment(comment._id);
        
        logger.info(`✅ تم إضافة تعليق على القضية #${issue.number}`);
        
        res.status(201).json({
            success: true,
            comment,
            message: 'تم إضافة التعليق بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل إضافة التعليق:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إضافة التعليق'
        });
    }
});

// ===== إغلاق قضية =====
router.post('/:id/close', authMiddleware, async (req, res) => {
    try {
        const issue = await Issue.findById(req.params.id);
        if (!issue) {
            return res.status(404).json({
                success: false,
                message: 'القضية غير موجودة'
            });
        }
        
        await issue.close(req.user._id);
        
        logger.info(`✅ تم إغلاق القضية #${issue.number}`);
        
        res.json({
            success: true,
            message: 'تم إغلاق القضية بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل إغلاق القضية:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إغلاق القضية'
        });
    }
});

module.exports = router;