// ============================================================
// ===== BCRYPT UTILS — أدوات التشفير =====
// ============================================================

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ===== إعدادات التشفير =====
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;
const HASH_ALGORITHM = 'sha256';

// ===== تشفير كلمة المرور =====
const hashPassword = async (password, rounds = SALT_ROUNDS) => {
    if (!password) {
        throw new Error('كلمة المرور مطلوبة للتشفير');
    }
    
    try {
        const salt = await bcrypt.genSalt(rounds);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        console.error('❌ فشل تشفير كلمة المرور:', error);
        throw new Error('حدث خطأ أثناء تشفير كلمة المرور');
    }
};

// ===== التحقق من كلمة المرور =====
const comparePassword = async (password, hashedPassword) => {
    if (!password || !hashedPassword) {
        throw new Error('كلمة المرور والتشفير مطلوبان للمقارنة');
    }
    
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        console.error('❌ فشل مقارنة كلمة المرور:', error);
        throw new Error('حدث خطأ أثناء مقارنة كلمة المرور');
    }
};

// ===== توليد كلمة مرور عشوائية =====
const generateRandomPassword = (length = 12) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    let password = '';
    
    // ضمان وجود حرف كبير وصغير ورقم ورمز
    const types = [
        () => chars.charAt(Math.floor(Math.random() * 26)), // lowercase
        () => chars.charAt(Math.floor(Math.random() * 26) + 26), // uppercase
        () => chars.charAt(Math.floor(Math.random() * 10) + 52), // digit
        () => chars.charAt(Math.floor(Math.random() * 14) + 62) // special
    ];
    
    for (let i = 0; i < length; i++) {
        const type = types[i % types.length];
        password += type();
    }
    
    // خلط الكلمة
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

// ===== التحقق من قوة كلمة المرور =====
const checkPasswordStrength = (password) => {
    let score = 0;
    const checks = [
        { test: password.length >= 8, message: 'طول كلمة المرور 8 أحرف على الأقل' },
        { test: password.length >= 12, message: 'طول كلمة المرور 12 حرفاً على الأقل' },
        { test: /[a-z]/.test(password), message: 'يحتوي على حرف صغير' },
        { test: /[A-Z]/.test(password), message: 'يحتوي على حرف كبير' },
        { test: /[0-9]/.test(password), message: 'يحتوي على رقم' },
        { test: /[!@#$%^&*()_+-=]/.test(password), message: 'يحتوي على رمز خاص' }
    ];
    
    const results = checks.map(check => {
        const passed = check.test(password);
        if (passed) score++;
        return { ...check, passed };
    });
    
    const levels = ['ضعيف جداً', 'ضعيف', 'متوسط', 'قوي', 'قوي جداً', 'ممتاز', 'خارق'];
    const level = levels[Math.min(score, levels.length - 1)];
    
    return {
        score,
        level,
        maxScore: checks.length,
        results,
        isStrong: score >= 4,
        isVeryStrong: score >= 5
    };
};

// ===== توليد ملح عشوائي =====
const generateSalt = (length = 16) => {
    return crypto.randomBytes(length).toString('hex');
};

// ===== تشفير نص باستخدام SHA =====
const hashText = (text, algorithm = HASH_ALGORITHM) => {
    return crypto.createHash(algorithm).update(text).digest('hex');
};

// ===== التحقق من النص المشفر =====
const verifyHash = (text, hashedText, algorithm = HASH_ALGORITHM) => {
    const newHash = hashText(text, algorithm);
    return newHash === hashedText;
};

// ===== تشفير باستخدام HMAC =====
const hmacHash = (text, secret, algorithm = HASH_ALGORITHM) => {
    return crypto.createHmac(algorithm, secret).update(text).digest('hex');
};

// ===== توليد رمز تحقق عشوائي =====
const generateVerificationCode = (length = 6) => {
    return crypto.randomInt(Math.pow(10, length - 1), Math.pow(10, length)).toString();
};

// ===== توليد معرف فريد =====
const generateUniqueId = () => {
    return crypto.randomBytes(16).toString('hex');
};

// ===== تصدير =====
module.exports = {
    hashPassword,
    comparePassword,
    generateRandomPassword,
    checkPasswordStrength,
    generateSalt,
    hashText,
    verifyHash,
    hmacHash,
    generateVerificationCode,
    generateUniqueId,
    SALT_ROUNDS,
    HASH_ALGORITHM
};