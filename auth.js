// ============================================================
// ===== AUTH ROUTES — مسارات المصادقة =====
// ============================================================

const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const { 
    validateRegistration, 
    validateLogin 
} = require('../middleware/validation');

// ===== إعدادات البريد الإلكتروني =====
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ===== تسجيل مستخدم جديد =====
router.post('/register', validateRegistration, async (req, res) => {
    try {
        const { username, email, password, name } = req.body;

        // التحقق من وجود المستخدم
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل'
            });
        }

        // إنشاء المستخدم
        const user = new User({
            username,
            email,
            password,
            name: name || username
        });

        await user.save();

        // توليد رمز التحقق
        const token = user.generateVerificationToken();
        await user.save();

        // إرسال بريد التحقق
        try {
            const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify/${token}`;
            await transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@github-clone.com',
                to: user.email,
                subject: '🔐 تحقق من حسابك على GitHub Clone',
                html: `
                    <h1>مرحباً ${user.name}!</h1>
                    <p>شكراً لتسجيلك في GitHub Clone.</p>
                    <p>يرجى النقر على الرابط التالي لتأكيد حسابك:</p>
                    <a href="${verifyUrl}">${verifyUrl}</a>
                    <p>الرابط صالح لمدة 24 ساعة.</p>
                    <p>إذا لم تقم بإنشاء هذا الحساب، يرجى تجاهل هذا البريد.</p>
                `
            });
            logger.info(`📧 تم إرسال بريد التحقق إلى ${user.email}`);
        } catch (emailError) {
            logger.error('❌ فشل إرسال بريد التحقق:', emailError);
        }

        // توليد JWT
        const jwtToken = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET || 'github-clone-secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني.',
            token: jwtToken,
            user: user.toJSON()
        });

    } catch (error) {
        logger.error('❌ خطأ في التسجيل:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إنشاء الحساب'
        });
    }
});

// ===== تسجيل الدخول =====
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { username, password } = req.body;

        // البحث عن المستخدم
        const user = await User.findOne({
            $or: [{ username }, { email: username }]
        }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        // التحقق من كلمة المرور
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        // التحقق من البريد الإلكتروني
        if (!user.isEmailVerified) {
            return res.status(401).json({
                success: false,
                message: 'يرجى التحقق من بريدك الإلكتروني أولاً'
            });
        }

        // التحقق من حالة الحساب
        if (user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: 'الحساب معلق، يرجى التواصل مع الدعم'
            });
        }

        // تحديث آخر نشاط
        user.lastActive = new Date();
        await user.save();

        // توليد JWT
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET || 'github-clone-secret',
            { expiresIn: '7d' }
        );

        // إعداد الجلسة
        req.login(user, (err) => {
            if (err) {
                logger.error('❌ خطأ في تسجيل الدخول:', err);
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ أثناء تسجيل الدخول'
                });
            }
            
            logger.info(`✅ تسجيل دخول ناجح: ${user.username}`);
            res.json({
                success: true,
                message: 'تم تسجيل الدخول بنجاح',
                token,
                user: user.toJSON()
            });
        });

    } catch (error) {
        logger.error('❌ خطأ في تسجيل الدخول:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تسجيل الدخول'
        });
    }
});

// ===== تسجيل الخروج =====
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            lastActive: new Date()
        });

        req.logout((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ أثناء تسجيل الخروج'
                });
            }
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'حدث خطأ أثناء تسجيل الخروج'
                    });
                }
                logger.info(`👋 تسجيل خروج: ${req.user.username}`);
                res.json({
                    success: true,
                    message: 'تم تسجيل الخروج بنجاح'
                });
            });
        });

    } catch (error) {
        logger.error('❌ خطأ في تسجيل الخروج:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تسجيل الخروج'
        });
    }
});

// ===== التحقق من المصادقة =====
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('followers', 'username name avatarUrl')
            .populate('following', 'username name avatarUrl');
            
        res.json({
            success: true,
            user: user.toJSON()
        });
    } catch (error) {
        logger.error('❌ خطأ في التحقق:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء التحقق'
        });
    }
});

// ===== تأكيد البريد الإلكتروني =====
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'الرمز غير صالح أو منتهي الصلاحية'
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        logger.info(`✅ تم تأكيد البريد الإلكتروني: ${user.username}`);
        res.json({
            success: true,
            message: 'تم تأكيد البريد الإلكتروني بنجاح'
        });

    } catch (error) {
        logger.error('❌ خطأ في تأكيد البريد:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تأكيد البريد الإلكتروني'
        });
    }
});

// ===== طلب إعادة تعيين كلمة المرور =====
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'لا يوجد حساب بهذا البريد الإلكتروني'
            });
        }

        const token = user.generateResetToken();
        await user.save();

        // إرسال البريد الإلكتروني
        try {
            const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${token}`;
            await transporter.sendMail({
                from: process.env.SMTP_FROM || 'noreply@github-clone.com',
                to: user.email,
                subject: '🔑 إعادة تعيين كلمة المرور',
                html: `
                    <h1>مرحباً ${user.name}!</h1>
                    <p>لقد طلبت إعادة تعيين كلمة المرور الخاصة بك.</p>
                    <p>يرجى النقر على الرابط التالي لتعيين كلمة مرور جديدة:</p>
                    <a href="${resetUrl}">${resetUrl}</a>
                    <p>الرابط صالح لمدة ساعة واحدة.</p>
                    <p>إذا لم تطلب ذلك، يرجى تجاهل هذا البريد.</p>
                `
            });
            logger.info(`📧 تم إرسال رابط إعادة التعيين إلى ${user.email}`);
        } catch (emailError) {
            logger.error('❌ فشل إرسال بريد إعادة التعيين:', emailError);
        }

        res.json({
            success: true,
            message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
        });

    } catch (error) {
        logger.error('❌ خطأ في إعادة تعيين كلمة المرور:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إعادة تعيين كلمة المرور'
        });
    }
});

// ===== إعادة تعيين كلمة المرور =====
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
            });
        }

        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'الرمز غير صالح أو منتهي الصلاحية'
            });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        logger.info(`✅ تم إعادة تعيين كلمة المرور: ${user.username}`);
        res.json({
            success: true,
            message: 'تم إعادة تعيين كلمة المرور بنجاح'
        });

    } catch (error) {
        logger.error('❌ خطأ في إعادة تعيين كلمة المرور:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إعادة تعيين كلمة المرور'
        });
    }
});

// ===== تغيير كلمة المرور =====
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'كلمة المرور الحالية والجديدة مطلوبة'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'
            });
        }

        const user = await User.findById(req.user._id).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'كلمة المرور الحالية غير صحيحة'
            });
        }

        user.password = newPassword;
        await user.save();

        logger.info(`✅ تم تغيير كلمة المرور: ${user.username}`);
        res.json({
            success: true,
            message: 'تم تغيير كلمة المرور بنجاح'
        });

    } catch (error) {
        logger.error('❌ خطأ في تغيير كلمة المرور:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تغيير كلمة المرور'
        });
    }
});

// ===== مصادقة GitHub OAuth =====
router.get('/github', passport.authenticate('github', {
    scope: ['user:email', 'repo']
}));

router.get('/github/callback', 
    passport.authenticate('github', {
        failureRedirect: '/login',
        successRedirect: '/dashboard'
    })
);

// ===== مصادقة Google OAuth =====
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        successRedirect: '/dashboard'
    })
);

module.exports = router;