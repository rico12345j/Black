// ============================================================
// ===== USERS ROUTES — مسارات المستخدمين =====
// ============================================================

const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Repository = require('../models/Repository');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const { validateProfileUpdate } = require('../middleware/validation');

// ===== الحصول على ملف شخصي =====
router.get('/:username', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        const user = await User.findOne({ username })
            .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires -twoFactorSecret -twoFactorBackupCodes -sshKeys -gpgKeys');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        const repos = await Repository.find({ 
            owner: user._id,
            isPublic: true 
        })
        .sort({ stars: -1, updatedAt: -1 })
        .limit(10);
        
        let isFollowing = false;
        if (req.user) {
            isFollowing = req.user.isFollowing(user._id);
        }
        
        res.json({
            success: true,
            user: user.toJSON(),
            repos,
            isFollowing,
            stats: {
                reposCount: await Repository.countDocuments({ owner: user._id }),
                followersCount: user.followers.length,
                followingCount: user.following.length,
                starsCount: await Repository.countDocuments({ stargazers: user._id })
            }
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على الملف الشخصي:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب الملف الشخصي'
        });
    }
});

// ===== متابعة مستخدم =====
router.post('/:username/follow', authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        if (targetUser._id.equals(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن متابعة نفسك'
            });
        }
        
        await req.user.follow(targetUser._id);
        
        logger.info(`✅ ${req.user.username} يتابع ${username}`);
        
        res.json({
            success: true,
            message: `تم متابعة ${username} بنجاح`
        });
    } catch (error) {
        logger.error('❌ فشل المتابعة:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء المتابعة'
        });
    }
});

// ===== إلغاء متابعة مستخدم =====
router.delete('/:username/follow', authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        await req.user.unfollow(targetUser._id);
        
        logger.info(`✅ ${req.user.username} ألغى متابعة ${username}`);
        
        res.json({
            success: true,
            message: `تم إلغاء متابعة ${username} بنجاح`
        });
    } catch (error) {
        logger.error('❌ فشل إلغاء المتابعة:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إلغاء المتابعة'
        });
    }
});

// ===== الحصول على متابعي المستخدم =====
router.get('/:username/followers', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        const user = await User.findOne({ username })
            .populate('followers', 'username name avatarUrl bio');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        res.json({
            success: true,
            followers: user.followers
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على المتابعين:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب المتابعين'
        });
    }
});

// ===== الحصول على من يتابعهم المستخدم =====
router.get('/:username/following', optionalAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        const user = await User.findOne({ username })
            .populate('following', 'username name avatarUrl bio');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'المستخدم غير موجود'
            });
        }
        
        res.json({
            success: true,
            following: user.following
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على المتابعين:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب المتابعين'
        });
    }
});

// ===== تحديث الملف الشخصي =====
router.put('/profile', authMiddleware, validateProfileUpdate, async (req, res) => {
    try {
        const { name, bio, location, website, company, twitter, avatarUrl } = req.body;
        
        const user = await User.findById(req.user._id);
        
        if (name !== undefined) user.name = name;
        if (bio !== undefined) user.bio = bio;
        if (location !== undefined) user.location = location;
        if (website !== undefined) user.website = website;
        if (company !== undefined) user.company = company;
        if (twitter !== undefined) user.twitter = twitter;
        if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
        
        user.updatedAt = Date.now();
        await user.save();
        
        logger.info(`✅ تم تحديث الملف الشخصي لـ ${user.username}`);
        
        res.json({
            success: true,
            user: user.toJSON(),
            message: 'تم تحديث الملف الشخصي بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل تحديث الملف الشخصي:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تحديث الملف الشخصي'
        });
    }
});

// ===== الحصول على المستخدم الحالي =====
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('followers', 'username name avatarUrl')
            .populate('following', 'username name avatarUrl');
        
        // حساب عدد المستودعات
        const reposCount = await Repository.countDocuments({ owner: req.user._id });
        user._reposCount = reposCount;
        
        res.json({
            success: true,
            user: user.toJSON()
        });
    } catch (error) {
        logger.error('❌ فشل الحصول على المستخدم الحالي:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب المستخدم'
        });
    }
});

module.exports = router;