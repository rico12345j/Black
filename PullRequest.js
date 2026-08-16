// ============================================================
// ===== PULL REQUEST MODEL — نموذج طلب السحب =====
// ============================================================

const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'عنوان الطلب مطلوب'],
        trim: true,
        maxlength: [255, 'العنوان يجب أن يكون 255 حرف كحد أقصى']
    },
    body: {
        type: String,
        trim: true,
        maxlength: [10000, 'الوصف يجب أن يكون 10000 حرف كحد أقصى'],
        default: ''
    },
    number: {
        type: Number,
        required: true
    },
    state: {
        type: String,
        enum: ['open', 'closed', 'merged'],
        default: 'open'
    },
    repository: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    baseBranch: {
        type: String,
        required: true,
        default: 'main'
    },
    headBranch: {
        type: String,
        required: true
    },
    headRepo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    },
    assignees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    reviewers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    labels: [{
        name: String,
        color: String,
        description: String
    }],
    milestone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Milestone'
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }],
    commentsCount: {
        type: Number,
        default: 0
    },
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
        deletions: Number
    }],
    commitsCount: {
        type: Number,
        default: 0
    },
    changedFiles: [String],
    additions: {
        type: Number,
        default: 0
    },
    deletions: {
        type: Number,
        default: 0
    },
    checks: {
        type: Map,
        of: String,
        default: {}
    },
    draft: {
        type: Boolean,
        default: false
    },
    locked: {
        type: Boolean,
        default: false
    },
    mergedAt: Date,
    mergedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    mergeCommitSha: String,
    closedAt: Date,
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ===== الفهارس =====
pullRequestSchema.index({ repository: 1, number: 1 }, { unique: true });
pullRequestSchema.index({ repository: 1, state: 1 });
pullRequestSchema.index({ author: 1 });
pullRequestSchema.index({ assignees: 1 });
pullRequestSchema.index({ reviewers: 1 });
pullRequestSchema.index({ createdAt: -1 });
pullRequestSchema.index({ headBranch: 1 });

// ===== الحقول الافتراضية =====
pullRequestSchema.virtual('isOpen').get(function() {
    return this.state === 'open';
});

pullRequestSchema.virtual('isMerged').get(function() {
    return this.state === 'merged';
});

pullRequestSchema.virtual('isClosed').get(function() {
    return this.state === 'closed';
});

pullRequestSchema.virtual('isDraft').get(function() {
    return this.draft === true;
});

pullRequestSchema.virtual('changes').get(function() {
    return this.additions + this.deletions;
});

// ===== دوال الاستاتيك =====
pullRequestSchema.statics.findByRepository = function(repoId, options = {}) {
    const { state = 'open', limit = 30, skip = 0, sort = 'createdAt', order = 'desc' } = options;
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sort]: sortOrder };
    
    return this.find({ repository: repoId, state })
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username name avatarUrl')
        .populate('assignees', 'username name avatarUrl')
        .populate('reviewers', 'username name avatarUrl')
        .populate('labels');
};

pullRequestSchema.statics.getNextNumber = async function(repoId) {
    const lastPR = await this.findOne({ repository: repoId })
        .sort({ number: -1 })
        .select('number');
    return (lastPR ? lastPR.number : 0) + 1;
};

pullRequestSchema.statics.getStats = async function(repoId) {
    const stats = await this.aggregate([
        { $match: { repository: repoId } },
        { $group: {
            _id: '$state',
            count: { $sum: 1 }
        }}
    ]);
    
    const result = { open: 0, closed: 0, merged: 0 };
    stats.forEach(stat => {
        result[stat._id] = stat.count;
    });
    return result;
};

// ===== دوال المثيل =====
pullRequestSchema.methods.addComment = async function(commentId) {
    if (!this.comments.includes(commentId)) {
        this.comments.push(commentId);
        this.commentsCount += 1;
        this.updatedAt = Date.now();
    }
    return this.save();
};

pullRequestSchema.methods.removeComment = async function(commentId) {
    this.comments = this.comments.filter(id => id.toString() !== commentId.toString());
    this.commentsCount = Math.max(0, this.commentsCount - 1);
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.merge = async function(userId, commitSha = null) {
    this.state = 'merged';
    this.mergedAt = Date.now();
    this.mergedBy = userId;
    if (commitSha) this.mergeCommitSha = commitSha;
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.close = async function(userId) {
    this.state = 'closed';
    this.closedAt = Date.now();
    this.closedBy = userId;
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.reopen = async function() {
    this.state = 'open';
    this.closedAt = undefined;
    this.closedBy = undefined;
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.addReviewer = function(userId) {
    if (!this.reviewers.includes(userId)) {
        this.reviewers.push(userId);
        this.updatedAt = Date.now();
    }
    return this.save();
};

pullRequestSchema.methods.removeReviewer = function(userId) {
    this.reviewers = this.reviewers.filter(id => id.toString() !== userId.toString());
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.addCommit = function(commitData) {
    this.commits.push(commitData);
    this.commitsCount += 1;
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.updateStats = function() {
    this.additions = this.commits.reduce((sum, c) => sum + (c.additions || 0), 0);
    this.deletions = this.commits.reduce((sum, c) => sum + (c.deletions || 0), 0);
    this.changedFiles = [...new Set(this.commits.flatMap(c => c.files || []))];
    return this.save();
};

pullRequestSchema.methods.toggleLock = function() {
    this.locked = !this.locked;
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.toggleDraft = function() {
    this.draft = !this.draft;
    this.updatedAt = Date.now();
    return this.save();
};

pullRequestSchema.methods.addCheck = function(checkName, status) {
    this.checks.set(checkName, status);
    this.updatedAt = Date.now();
    return this.save();
};

const PullRequest = mongoose.model('PullRequest', pullRequestSchema);

module.exports = PullRequest;