// ============================================================
// ===== REPOSITORY MODEL — نموذج المستودع =====
// ============================================================

const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم المستودع مطلوب'],
        trim: true,
        match: [/^[a-zA-Z0-9_.-]+$/, 'اسم المستودع يحتوي على أحرف غير مسموحة']
    },
    description: {
        type: String,
        maxlength: [500, 'الوصف يجب أن يكون 500 حرف كحد أقصى'],
        default: ''
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    isFork: {
        type: Boolean,
        default: false
    },
    forkSource: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    },
    stars: {
        type: Number,
        default: 0
    },
    watchers: {
        type: Number,
        default: 0
    },
    forks: {
        type: Number,
        default: 0
    },
    issues: {
        type: Number,
        default: 0
    },
    pullRequests: {
        type: Number,
        default: 0
    },
    language: {
        type: String,
        default: 'JavaScript'
    },
    languages: {
        type: Map,
        of: Number,
        default: {}
    },
    topics: [{
        type: String,
        trim: true
    }],
    license: {
        type: String,
        default: 'MIT'
    },
    defaultBranch: {
        type: String,
        default: 'main'
    },
    branches: [{
        name: {
            type: String,
            required: true
        },
        lastCommit: Date,
        protected: {
            type: Boolean,
            default: false
        },
        requiredReviews: {
            type: Number,
            default: 0
        },
        requiredStatusChecks: [String]
    }],
    commits: [{
        hash: {
            type: String,
            required: true
        },
        message: String,
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: {
            type: Date,
            default: Date.now
        },
        files: [String],
        additions: Number,
        deletions: Number,
        parent: String
    }],
    tags: [{
        name: String,
        commit: String,
        date: Date,
        message: String
    }],
    collaborators: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        permission: {
            type: String,
            enum: ['read', 'triage', 'write', 'maintain', 'admin'],
            default: 'read'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    watchersList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    stargazers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    forkList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastCommitAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ===== الفهارس =====
repositorySchema.index({ name: 1, owner: 1 }, { unique: true });
repositorySchema.index({ owner: 1 });
repositorySchema.index({ stars: -1 });
repositorySchema.index({ language: 1 });
repositorySchema.index({ topics: 1 });
repositorySchema.index({ isPublic: 1 });
repositorySchema.index({ 'commits.date': -1 });
repositorySchema.index({ lastCommitAt: -1 });

// ===== الحقول الافتراضية =====
repositorySchema.virtual('fullName').get(function() {
    return `${this.ownerUsername}/${this.name}`;
});

repositorySchema.virtual('url').get(function() {
    return `/${this.ownerUsername}/${this.name}`;
});

repositorySchema.virtual('isOwner').get(function() {
    return (userId) => this.owner.toString() === userId.toString();
});

repositorySchema.virtual('isCollaborator').get(function() {
    return (userId) => this.collaborators.some(c => c.user.toString() === userId.toString());
});

// ===== دوال الاستاتيك =====
repositorySchema.statics.findByOwner = function(ownerId) {
    return this.find({ owner: ownerId }).sort({ createdAt: -1 });
};

repositorySchema.statics.findPublic = function() {
    return this.find({ isPublic: true }).sort({ stars: -1 });
};

repositorySchema.statics.findTrending = function(days = 7, limit = 10) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.find({
        isPublic: true,
        createdAt: { $gte: date }
    }).sort({ stars: -1 }).limit(limit);
};

repositorySchema.statics.search = function(query, options = {}) {
    const { limit = 10, language, topics, sort = 'stars' } = options;
    const filter = {
        isPublic: true,
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { topics: { $regex: query, $options: 'i' } }
        ]
    };
    if (language) filter.language = language;
    if (topics && topics.length) filter.topics = { $in: topics };
    
    return this.find(filter)
        .sort({ [sort]: -1, updatedAt: -1 })
        .limit(limit)
        .populate('owner', 'username name avatarUrl');
};

// ===== دوال المثيل =====
repositorySchema.methods.isOwner = function(userId) {
    return this.owner.toString() === userId.toString();
};

repositorySchema.methods.isCollaborator = function(userId) {
    return this.collaborators.some(c => c.user.toString() === userId.toString());
};

repositorySchema.methods.hasPermission = function(userId, permission) {
    if (this.isOwner(userId)) return true;
    const collaborator = this.collaborators.find(c => c.user.toString() === userId.toString());
    if (!collaborator) return false;
    const permissions = ['read', 'triage', 'write', 'maintain', 'admin'];
    return permissions.indexOf(collaborator.permission) >= permissions.indexOf(permission);
};

repositorySchema.methods.addCollaborator = function(userId, permission = 'read') {
    if (!this.isCollaborator(userId)) {
        this.collaborators.push({ user: userId, permission });
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.removeCollaborator = function(userId) {
    this.collaborators = this.collaborators.filter(c => c.user.toString() !== userId.toString());
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.updateCollaboratorPermission = function(userId, permission) {
    const collaborator = this.collaborators.find(c => c.user.toString() === userId.toString());
    if (collaborator) {
        collaborator.permission = permission;
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.addStar = function(userId) {
    if (!this.stargazers.includes(userId)) {
        this.stargazers.push(userId);
        this.stars += 1;
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.removeStar = function(userId) {
    this.stargazers = this.stargazers.filter(id => id.toString() !== userId.toString());
    if (this.stars > 0) this.stars -= 1;
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.addWatcher = function(userId) {
    if (!this.watchersList.includes(userId)) {
        this.watchersList.push(userId);
        this.watchers += 1;
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.removeWatcher = function(userId) {
    this.watchersList = this.watchersList.filter(id => id.toString() !== userId.toString());
    if (this.watchers > 0) this.watchers -= 1;
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.addFork = function(repoId) {
    if (!this.forkList.includes(repoId)) {
        this.forkList.push(repoId);
        this.forks += 1;
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.addIssue = function() {
    this.issues += 1;
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.removeIssue = function() {
    if (this.issues > 0) this.issues -= 1;
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.addPull = function() {
    this.pullRequests += 1;
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.removePull = function() {
    if (this.pullRequests > 0) this.pullRequests -= 1;
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.addCommit = function(commitData) {
    this.commits.push(commitData);
    this.lastCommitAt = Date.now();
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.addBranch = function(branchName) {
    if (!this.branches.some(b => b.name === branchName)) {
        this.branches.push({ name: branchName });
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.removeBranch = function(branchName) {
    this.branches = this.branches.filter(b => b.name !== branchName);
    this.updatedAt = Date.now();
    return this.save();
};

repositorySchema.methods.protectBranch = function(branchName, options = {}) {
    const branch = this.branches.find(b => b.name === branchName);
    if (branch) {
        branch.protected = true;
        if (options.requiredReviews) branch.requiredReviews = options.requiredReviews;
        if (options.requiredStatusChecks) branch.requiredStatusChecks = options.requiredStatusChecks;
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

repositorySchema.methods.unprotectBranch = function(branchName) {
    const branch = this.branches.find(b => b.name === branchName);
    if (branch) {
        branch.protected = false;
        branch.requiredReviews = 0;
        branch.requiredStatusChecks = [];
        this.updatedAt = Date.now();
        return this.save();
    }
    return this;
};

const Repository = mongoose.model('Repository', repositorySchema);

module.exports = Repository;