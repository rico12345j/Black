// ============================================================
// ===== PULL REQUESTS ROUTES — مسارات طلبات السحب =====
// ============================================================

const express = require('express');
const router = express.Router();

const PullRequest = require('../models/PullRequest');
const Repository = require('../models/Repository');
const Comment = require('../models/Comment');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const { validatePullRequest, validateComment } = require('../middleware/validation');

// ===== الحصول على قائمة طلبات السحب =====
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { repoId, state = 'open', page = 1, limit = 30, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;
        const sortOrder = order === 'asc' ? 1 : -1;
        
        const filter = { state };
        if (repoId) filter.repository = repoId;
        
        const pulls = await PullRequest.find(filter)
            .sort({ [sort]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'username name avatarUrl')
            .populate('assignees', 'username name avatarUrl')
            .populate('reviewers', 'username name avatarUrl')
            .populate('repository', 'name owner')
            .populate('labels');
        
        const total = await PullRequest.countDocuments(filter);
        
        res.json({
            success: true,
            pulls,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على طلبات السحب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب طلبات السحب'
        });
    }
});

// ===== إنشاء طلب سحب جديد =====
router.post('/', authMiddleware, validatePullRequest, async (req, res) => {
    try {
        const { 
            repositoryId, title, body, baseBranch, headBranch, headRepo,
            draft = false, assignees, reviewers, labels 
        } = req.body;
        
        const repo = await Repository.findById(repositoryId);
        if (!repo) {
            return res.status(404).json({
                success: false,
                message: 'المستودع غير موجود'
            });
        }
        
        if (!repo.isOwner(req.user._id) && !repo.isCollaborator(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لإنشاء طلبات سحب'
            });
        }
        
        const number = await PullRequest.getNextNumber(repositoryId);
        
        const pull = new PullRequest({
            number,
            title,
            body: body || '',
            repository: repositoryId,
            author: req.user._id,
            baseBranch: baseBranch || 'main',
            headBranch,
            headRepo,
            draft,
            assignees: assignees || [],
            reviewers: reviewers || [],
            labels: labels || []
        });
        
        await pull.save();
        
        await Repository.findByIdAndUpdate(repositoryId, {
            $inc: { pullRequests: 1 }
        });
        
        logger.info(`✅ تم إنشاء طلب سحب #${number} في ${repo.name}`);
        
        res.status(201).json({
            success: true,
            pull,
            message: 'تم إنشاء طلب السحب بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل إنشاء طلب السحب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إنشاء طلب السحب'
        });
    }
});

// ===== الحصول على طلب سحب =====
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const pull = await PullRequest.findById(req.params.id)
            .populate('author', 'username name avatarUrl')
            .populate('assignees', 'username name avatarUrl')
            .populate('reviewers', 'username name avatarUrl')
            .populate('repository', 'name owner')
            .populate('comments', 'author body createdAt replies')
            .populate({
                path: 'comments',
                populate: {
                    path: 'author',
                    select: 'username name avatarUrl'
                }
            });
        
        if (!pull) {
            return res.status(404).json({
                success: false,
                message: 'طلب السحب غير موجود'
            });
        }
        
        res.json({
            success: true,
            pull
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على طلب السحب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب طلب السحب'
        });
    }
});

// ===== تحديث طلب سحب =====
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, body, state, assignees, reviewers, labels, draft } = req.body;
        
        const pull = await PullRequest.findById(req.params.id);
        if (!pull) {
            return res.status(404).json({
                success: false,
                message: 'طلب السحب غير موجود'
            });
        }
        
        if (!pull.author.equals(req.user._id) && !pull.repository.owner.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لتعديل هذا الطلب'
            });
        }
        
        if (title !== undefined) pull.title = title;
        if (body !== undefined) pull.body = body;
        if (state !== undefined) {
            if (state === 'closed') {
                await pull.close(req.user._id);
            } else if (state === 'merged') {
                await pull.merge(req.user._id);
            } else if (state === 'open') {
                await pull.reopen();
            }
        }
        if (assignees !== undefined) pull.assignees = assignees;
        if (reviewers !== undefined) pull.reviewers = reviewers;
        if (labels !== undefined) pull.labels = labels;
        if (draft !== undefined) pull.draft = draft;
        
        pull.updatedAt = Date.now();
        await pull.save();
        
        logger.info(`✅ تم تحديث طلب السحب #${pull.number}`);
        
        res.json({
            success: true,
            pull,
            message: 'تم تحديث طلب السحب بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل تحديث طلب السحب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تحديث طلب السحب'
        });
    }
});

// ===== حذف طلب سحب =====
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const pull = await PullRequest.findById(req.params.id);
        if (!pull) {
            return res.status(404).json({
                success: false,
                message: 'طلب السحب غير موجود'
            });
        }
        
        if (!pull.author.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لحذف هذا الطلب'
            });
        }
        
        await PullRequest.findByIdAndDelete(req.params.id);
        
        await Repository.findByIdAndUpdate(pull.repository, {
            $inc: { pullRequests: -1 }
        });
        
        logger.info(`✅ تم حذف طلب السحب #${pull.number}`);
        
        res.json({
            success: true,
            message: 'تم حذف طلب السحب بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل حذف طلب السحب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء حذف طلب السحب'
        });
    }
});

// ===== دمج طلب سحب =====
router.post('/:id/merge', authMiddleware, async (req, res) => {
    try {
        const { commitMessage } = req.body;
        
        const pull = await PullRequest.findById(req.params.id);
        if (!pull) {
            return res.status(404).json({
                success: false,
                message: 'طلب السحب غير موجود'
            });
        }
        
        if (!pull.repository.owner.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'غير مصرح: ليس لديك صلاحية لدمج هذا الطلب'
            });
        }
        
        if (pull.state !== 'open') {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن دمج طلب سحب غير مفتوح'
            });
        }
        
        await pull.merge(req.user._id);
        
        logger.info(`✅ تم دمج طلب السحب #${pull.number}`);
        
        res.json({
            success: true,
            message: 'تم دمج طلب السحب بنجاح',
            pull
        });
    } catch (error) {
        logger.error('❌ فشل دمج طلب السحب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء دمج طلب السحب'
        });
    }
});

// ===== إضافة تعليق على طلب سحب =====
router.post('/:id/comments', authMiddleware, validateComment, async (req, res) => {
    try {
        const { body } = req.body;
        
        const pull = await PullRequest.findById(req.params.id);
        if (!pull) {
            return res.status(404).json({
                success: false,
                message: 'طلب السحب غير موجود'
            });
        }
        
        const comment = new Comment({
            body,
            author: req.user._id,
            repository: pull.repository,
            pullRequest: pull._id
        });
        
        await comment.save();
        await pull.addComment(comment._id);
        
        logger.info(`✅ تم إضافة تعليق على طلب السحب #${pull.number}`);
        
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

module.exports = router;