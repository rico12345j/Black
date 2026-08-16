// ============================================================
// ===== SEARCH ROUTES — مسارات البحث =====
// ============================================================

const express = require('express');
const router = express.Router();

const Repository = require('../models/Repository');
const User = require('../models/User');
const Issue = require('../models/Issue');
const PullRequest = require('../models/PullRequest');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const { validateSearch } = require('../middleware/validation');

// ===== البحث العام =====
router.get('/', optionalAuth, validateSearch, async (req, res) => {
    try {
        const { q, type = 'all', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        const results = {
            repositories: [],
            users: [],
            issues: [],
            pullRequests: [],
            total: 0
        };
        
        let total = 0;
        
        if (type === 'all' || type === 'repositories') {
            const repos = await Repository.search(q, { limit, page });
            results.repositories = repos;
            total += repos.length;
        }
        
        if (type === 'all' || type === 'users') {
            const users = await User.search(q, limit);
            results.users = users;
            total += users.length;
        }
        
        if (type === 'all' || type === 'issues') {
            const issues = await Issue.find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { body: { $regex: q, $options: 'i' } }
                ],
                state: 'open'
            })
            .populate('author', 'username name avatarUrl')
            .populate('repository', 'name owner')
            .limit(limit)
            .skip(skip);
            
            results.issues = issues;
            total += issues.length;
        }
        
        if (type === 'all' || type === 'pullRequests') {
            const pulls = await PullRequest.find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { body: { $regex: q, $options: 'i' } }
                ],
                state: 'open'
            })
            .populate('author', 'username name avatarUrl')
            .populate('repository', 'name owner')
            .limit(limit)
            .skip(skip);
            
            results.pullRequests = pulls;
            total += pulls.length;
        }
        
        results.total = total;
        
        logger.info(`🔍 بحث: "${q}" - نوع: ${type} - نتائج: ${total}`);
        
        res.json({
            success: true,
            query: q,
            type,
            results,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        });
    } catch (error) {
        logger.error('❌ فشل البحث:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء البحث'
        });
    }
});

// ===== بحث متقدم في المستودعات =====
router.get('/repositories', optionalAuth, async (req, res) => {
    try {
        const { q, language, topics, sort = 'stars', order = 'desc', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        const options = {
            limit: parseInt(limit),
            language,
            topics: topics ? topics.split(',') : undefined,
            sort
        };
        
        const repos = await Repository.search(q, options)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(skip)
            .populate('owner', 'username name avatarUrl');
        
        const total = await Repository.countDocuments({
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { topics: { $regex: q, $options: 'i' } }
            ],
            isPublic: true,
            ...(language ? { language } : {})
        });
        
        res.json({
            success: true,
            query: q,
            repositories: repos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        });
    } catch (error) {
        logger.error('❌ فشل البحث في المستودعات:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء البحث في المستودعات'
        });
    }
});

// ===== بحث في المستخدمين =====
router.get('/users', optionalAuth, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        
        const users = await User.search(q, parseInt(limit))
            .select('username name avatarUrl bio followers following');
        
        res.json({
            success: true,
            query: q,
            users
        });
    } catch (error) {
        logger.error('❌ فشل البحث في المستخدمين:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء البحث في المستخدمين'
        });
    }
});

module.exports = router;