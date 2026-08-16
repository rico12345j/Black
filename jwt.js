// ============================================================
// ===== JWT UTILS — أدوات JWT =====
// ============================================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ===== إعدادات JWT =====
const JWT_SECRET = process.env.JWT_SECRET || 'github-clone-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

// ===== توليد JWT =====
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
    if (!payload) {
        throw new Error('البيانات المطلوبة للتوقيع غير موجودة');
    }
    
    try {
        return jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn }
        );
    } catch (error) {
        console.error('❌ فشل توليد JWT:', error);
        throw new Error('حدث خطأ أثناء توليد الرمز');
    }
};

// ===== توليد رمز التحديث =====
const generateRefreshToken = (payload) => {
    return generateToken(payload, REFRESH_TOKEN_EXPIRES_IN);
};

// ===== التحقق من JWT =====
const verifyToken = (token) => {
    if (!token) {
        throw new Error('الرمز مطلوب للتحقق');
    }
    
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('انتهت صلاحية الرمز');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('الرمز غير صالح');
        }
        throw new Error('حدث خطأ أثناء التحقق من الرمز');
    }
};

// ===== استخراج البيانات من JWT =====
const decodeToken = (token) => {
    if (!token) return null;
    
    try {
        return jwt.decode(token);
    } catch (error) {
        console.error('❌ فشل فك تشفير JWT:', error);
        return null;
    }
};

// ===== توليد رمز عشوائي =====
const generateRandomToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// ===== توليد رمز التحقق =====
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// ===== توليد رمز إعادة تعيين كلمة المرور =====
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// ===== توليد رمز 2FA =====
const generateTwoFactorSecret = () => {
    return crypto.randomBytes(20).toString('hex');
};

// ===== توليد كود 2FA =====
const generateTwoFactorCode = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// ===== توليد زوج من الرموز (وصول وتحديث) =====
const generateTokenPair = (payload) => {
    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    
    return {
        accessToken,
        refreshToken,
        expiresIn: JWT_EXPIRES_IN,
        refreshExpiresIn: REFRESH_TOKEN_EXPIRES_IN
    };
};

// ===== تجديد رمز الوصول =====
const refreshAccessToken = (refreshToken) => {
    try {
        const decoded = verifyToken(refreshToken);
        const { id, username, ...rest } = decoded;
        
        // توليد رمز وصول جديد
        const newAccessToken = generateToken({ id, username });
        
        return {
            accessToken: newAccessToken,
            expiresIn: JWT_EXPIRES_IN
        };
    } catch (error) {
        throw new Error('فشل تجديد رمز الوصول: ' + error.message);
    }
};

// ===== التحقق من صلاحية الرمز =====
const isTokenValid = (token) => {
    try {
        verifyToken(token);
        return true;
    } catch {
        return false;
    }
};

// ===== الحصول على باقي وقت صلاحية الرمز =====
const getTokenRemainingTime = (token) => {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return 0;
        
        const now = Math.floor(Date.now() / 1000);
        const remaining = decoded.exp - now;
        return Math.max(0, remaining);
    } catch {
        return 0;
    }
};

// ===== تصدير =====
module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    decodeToken,
    generateRandomToken,
    generateVerificationToken,
    generateResetToken,
    generateTwoFactorSecret,
    generateTwoFactorCode,
    generateTokenPair,
    refreshAccessToken,
    isTokenValid,
    getTokenRemainingTime,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN
};