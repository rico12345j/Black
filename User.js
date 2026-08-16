// ============================================================
// ===== USER MODEL — نموذج المستخدم =====
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'اسم المستخدم مطلوب'],
        unique: true,
        trim: true,
        minlength: [3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'],
        maxlength: [39, 'اسم المستخدم يجب أن يكون 39 حرفاً كحد أقصى'],
        match: [/^[a-zA-Z0-9_-]+$/, 'اسم المستخدم يحتوي على أحرف غير مسموحة']
    },
    email: {
        type: String,
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: [validator.isEmail, 'البريد الإلكتروني غير صالح']
    },
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'],
        select: false
    },
    name: {
        type: String,
        trim: true,
        maxlength: [100, 'الاسم يجب أن يكون 100 حرف كحد أقصى']
    },
    bio: {
        type: String,
        maxlength: [500, 'السيرة الذاتية يجب أن تكون 500 حرف كحد أقصى'],
        default: ''
    },
    avatarUrl: {
        type: String,
        default: function() {
            return `https://ui-avatars.com/api/?name=${this.username}&background=2d9cdb&color=fff&size=128`;
        }
    },
    location: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        default: '',
        validate: [validator.isURL, 'الرابط غير صالح']
    },
    company: {
        type: String,
        default: ''
    },
    twitter: {
        type: String,
        default: ''
    },
    github: {
        type: String,
        default: ''
    },
    githubId: String,
    googleId: String,
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    starredRepos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    }],
    watchingRepos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    }],
    isAdmin: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isHireable: {
        type: Boolean,
        default: false
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: String,
    twoFactorBackupCodes: [String],
    sshKeys: [{
        name: {
            type: String,
            required: true
        },
        key: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        lastUsed: Date
    }],
    gpgKeys: [{
        name: String,
        key: String,
        createdAt: Date
    }],
    contributions: {
        total: { type: Number, default: 0 },
        lastYear: { type: Number, default: 0 },
        lastMonth: { type: Number, default: 0 },
        lastWeek: { type: Number, default: 0 }
    },
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'auto'
        },
        language: {
            type: String,
            default: 'en'
        },
        notifications: {
            email: { type: Boolean, default: true },
            web: { type: Boolean, default: true },
            push: { type: Boolean, default: false }
        },
        visibility: {
            type: String,
            enum: ['public', 'private'],
            default: 'public'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ===== الفهارس =====
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });
userSchema.index({ 'contributions.total': -1 });
userSchema.index({ githubId: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });

// ===== الحقول الافتراضية =====
userSchema.virtual('followersCount').get(function() {
    return this.followers.length;
});

userSchema.virtual('followingCount').get(function() {
    return this.following.length;
});

userSchema.virtual('starsCount').get(function() {
    return this.starredRepos.length;
});

userSchema.virtual('reposCount').get(function() {
    return this._reposCount || 0;
});

userSchema.virtual('isFollowing').get(function() {
    return (userId) => this.following.some(id => id.toString() === userId.toString());
});

// ===== دوال قبل الحفظ =====
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

userSchema.pre('save', function(next) {
    if (!this.name) {
        this.name = this.username;
    }
    next();
});

// ===== دوال المثيل =====
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateResetToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
    this.resetPasswordExpires = Date.now() + 3600000; // 1 ساعة
    return token;
};

userSchema.methods.generateVerificationToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
    this.emailVerificationExpires = Date.now() + 86400000; // 24 ساعة
    return token;
};

userSchema.methods.generateTwoFactorSecret = function() {
    return crypto.randomBytes(20).toString('hex');
};

userSchema.methods.generateTwoFactorBackupCodes = function() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    this.twoFactorBackupCodes = codes.map(code => crypto
        .createHash('sha256')
        .update(code)
        .digest('hex')
    );
    return codes;
};

userSchema.methods.verifyTwoFactorBackupCode = function(code) {
    const hashed = crypto
        .createHash('sha256')
        .update(code)
        .digest('hex');
    const index = this.twoFactorBackupCodes.indexOf(hashed);
    if (index !== -1) {
        this.twoFactorBackupCodes.splice(index, 1);
        return true;
    }
    return false;
};

// ===== دوال العلاقات =====
userSchema.methods.follow = async function(userId) {
    if (this._id.toString() === userId.toString()) {
        throw new Error('لا يمكن متابعة نفسك');
    }
    
    if (!this.following.includes(userId)) {
        this.following.push(userId);
        await this.save();
        
        const targetUser = await this.model('User').findById(userId);
        if (targetUser && !targetUser.followers.includes(this._id)) {
            targetUser.followers.push(this._id);
            await targetUser.save();
        }
    }
    return this;
};

userSchema.methods.unfollow = async function(userId) {
    this.following = this.following.filter(id => id.toString() !== userId.toString());
    await this.save();
    
    const targetUser = await this.model('User').findById(userId);
    if (targetUser) {
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== this._id.toString());
        await targetUser.save();
    }
    return this;
};

userSchema.methods.starRepo = async function(repoId) {
    if (!this.starredRepos.includes(repoId)) {
        this.starredRepos.push(repoId);
        await this.save();
        
        const repo = await this.model('Repository').findById(repoId);
        if (repo) {
            await repo.addStar(this._id);
        }
    }
    return this;
};

userSchema.methods.unstarRepo = async function(repoId) {
    this.starredRepos = this.starredRepos.filter(id => id.toString() !== repoId.toString());
    await this.save();
    
    const repo = await this.model('Repository').findById(repoId);
    if (repo) {
        await repo.removeStar(this._id);
    }
    return this;
};

userSchema.methods.watchRepo = async function(repoId) {
    if (!this.watchingRepos.includes(repoId)) {
        this.watchingRepos.push(repoId);
        await this.save();
        
        const repo = await this.model('Repository').findById(repoId);
        if (repo) {
            await repo.addWatcher(this._id);
        }
    }
    return this;
};

userSchema.methods.unwatchRepo = async function(repoId) {
    this.watchingRepos = this.watchingRepos.filter(id => id.toString() !== repoId.toString());
    await this.save();
    
    const repo = await this.model('Repository').findById(repoId);
    if (repo) {
        await repo.removeWatcher(this._id);
    }
    return this;
};

// ===== دوال الاستاتيك =====
userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username });
};

userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email });
};

userSchema.statics.search = function(query, limit = 10) {
    return this.find({
        $or: [
            { username: { $regex: query, $options: 'i' } },
            { name: { $regex: query, $options: 'i' } },
            { bio: { $regex: query, $options: 'i' } }
        ]
    }).limit(limit);
};

userSchema.statics.getTopContributors = function(limit = 10) {
    return this.find()
        .sort({ 'contributions.total': -1 })
        .limit(limit);
};

// ===== تحويل إلى JSON =====
userSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.resetPasswordToken;
    delete obj.resetPasswordExpires;
    delete obj.emailVerificationToken;
    delete obj.emailVerificationExpires;
    delete obj.twoFactorSecret;
    delete obj.twoFactorBackupCodes;
    delete obj.sshKeys;
    delete obj.gpgKeys;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;