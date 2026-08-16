// ============================================================
// ===== PASSPORT CONFIG — إعدادات المصادقة =====
// ============================================================

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const User = require('../models/User');
const { logger } = require('../middleware/logger');

// ===== التسلسل والغاء التسلسل =====
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id)
            .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires -twoFactorSecret -twoFactorBackupCodes -sshKeys -gpgKeys');
        done(null, user);
    } catch (error) {
        logger.error('❌ فشل في deserializeUser:', error);
        done(error, null);
    }
});

// ===== استراتيجية Local =====
const localStrategy = new LocalStrategy(
    {
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true
    },
    async (req, username, password, done) => {
        try {
            // البحث عن المستخدم
            const user = await User.findOne({
                $or: [
                    { username: username.toLowerCase() },
                    { email: username.toLowerCase() }
                ]
            }).select('+password');

            if (!user) {
                logger.warning(`⚠️ محاولة تسجيل دخول فاشلة: ${username} (مستخدم غير موجود)`);
                return done(null, false, { message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
            }

            // التحقق من كلمة المرور
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                logger.warning(`⚠️ محاولة تسجيل دخول فاشلة: ${username} (كلمة مرور خاطئة)`);
                return done(null, false, { message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
            }

            // التحقق من البريد الإلكتروني
            if (!user.isEmailVerified) {
                logger.warning(`⚠️ محاولة تسجيل دخول: ${username} (البريد غير مفعل)`);
                return done(null, false, { message: 'يرجى تفعيل بريدك الإلكتروني أولاً' });
            }

            // تحديث آخر نشاط
            user.lastActive = new Date();
            await user.save();

            logger.info(`✅ تسجيل دخول ناجح: ${username}`);
            return done(null, user);
        } catch (error) {
            logger.error('❌ خطأ في استراتيجية Local:', error);
            return done(error);
        }
    }
);

// ===== استراتيجية JWT =====
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'github-clone-secret',
    passReqToCallback: true
};

const jwtStrategy = new JwtStrategy(jwtOptions, async (req, jwtPayload, done) => {
    try {
        const user = await User.findById(jwtPayload.id)
            .select('-password -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires -twoFactorSecret -twoFactorBackupCodes -sshKeys -gpgKeys');

        if (!user) {
            return done(null, false, { message: 'المستخدم غير موجود' });
        }

        // تحديث آخر نشاط
        user.lastActive = new Date();
        await user.save();

        return done(null, user);
    } catch (error) {
        logger.error('❌ خطأ في استراتيجية JWT:', error);
        return done(error);
    }
});

// ===== استراتيجية GitHub =====
const githubStrategy = new GitHubStrategy(
    {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback',
        scope: ['user:email', 'read:user']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            logger.info(`🔑 مصادقة GitHub: ${profile.username}`);

            let user = await User.findOne({ githubId: profile.id });

            if (!user) {
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                const username = profile.username || profile.displayName || profile.id;
                
                user = new User({
                    githubId: profile.id,
                    username: username.toLowerCase(),
                    email: email || `${username}@github.com`,
                    name: profile.displayName || username,
                    avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : `https://ui-avatars.com/api/?name=${username}&background=random`,
                    isEmailVerified: true,
                    github: profile.profileUrl
                });

                await user.save();
                logger.info(`✅ تم إنشاء مستخدم جديد من GitHub: ${username}`);
            }

            // تحديث آخر نشاط
            user.lastActive = new Date();
            await user.save();

            return done(null, user);
        } catch (error) {
            logger.error('❌ خطأ في استراتيجية GitHub:', error);
            return done(error);
        }
    }
);

// ===== استراتيجية Google =====
const googleStrategy = new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            logger.info(`🔑 مصادقة Google: ${profile.displayName}`);

            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                const username = email ? email.split('@')[0] : profile.id;
                
                user = new User({
                    googleId: profile.id,
                    username: username.toLowerCase(),
                    email: email || `${username}@google.com`,
                    name: profile.displayName || username,
                    avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : `https://ui-avatars.com/api/?name=${username}&background=random`,
                    isEmailVerified: true
                });

                await user.save();
                logger.info(`✅ تم إنشاء مستخدم جديد من Google: ${username}`);
            }

            // تحديث آخر نشاط
            user.lastActive = new Date();
            await user.save();

            return done(null, user);
        } catch (error) {
            logger.error('❌ خطأ في استراتيجية Google:', error);
            return done(error);
        }
    }
);

// ===== تسجيل الاستراتيجيات =====
passport.use('local', localStrategy);
passport.use('jwt', jwtStrategy);
passport.use('github', githubStrategy);
passport.use('google', googleStrategy);

// ===== دوال مساعدة =====
const authenticate = (strategy, options = {}) => {
    return passport.authenticate(strategy, { 
        session: false,
        ...options
    });
};

const authenticateLocal = (options = {}) => {
    return passport.authenticate('local', {
        session: true,
        ...options
    });
};

const authenticateJWT = (options = {}) => {
    return passport.authenticate('jwt', {
        session: false,
        ...options
    });
};

const authenticateGitHub = (options = {}) => {
    return passport.authenticate('github', {
        session: true,
        ...options
    });
};

const authenticateGoogle = (options = {}) => {
    return passport.authenticate('google', {
        session: true,
        ...options
    });
};

// ===== تصدير =====
module.exports = {
    passport,
    authenticate,
    authenticateLocal,
    authenticateJWT,
    authenticateGitHub,
    authenticateGoogle
};