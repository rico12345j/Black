// ============================================================
// ===== ISSUE MODEL — نموذج القضية =====
// ============================================================

const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'عنوان القضية مطلوب'],
        trim: true,
        maxlength: [255, 'العنوان يجب أن يكون 255 حرف كحد أقصى']
    },
    body: {
        type: String,
        required: [true, 'وصف القضية مطلوب'],
        trim: true,
        maxlength: [10000, 'الوصف يجب أن يكون 10000 حرف كحد أقصى']
    },
    number: {
        type: Number,
        required: true
    },
    state: {
        type: String,
        enum: ['open', 'closed'],
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
    assignees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    labels: [{
        name: {
            type: String,
            required: true
        },
        color: {
            type: String,
            default: '0075ca'
        },
        description: {
            type: String,
            default: ''
        }
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
    locked: {
        type: Boolean,
        default: false
    },
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
issueSchema.index({ repository: 1, number: 1 }, { unique: true });
issueSchema.index({ repository: 1, state: 1 });
issueSchema.index({ author: 1 });
issueSchema.index({ assignees: 1 });
issueSchema.index({ labels: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ closedAt: -1 });

// ===== الحقول الافتراضية =====
issueSchema.virtual('isOpen').get(function() {
    return this.state === 'open';
});

issueSchema.virtual('isClosed').get(function() {
    return this.state === 'closed';
});

issueSchema.virtual('age').get(function() {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// ===== دوال الاستاتيك =====
issueSchema.statics.findByRepository = function(repoId, options = {}) {
    const { state = 'open', limit = 30, skip = 0, sort = 'createdAt', order = 'desc' } = options;
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sort]: sortOrder };
    
    return this.find({ repository: repoId, state })
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username name avatarUrl')
        .populate('assignees', 'username name avatarUrl')
        .populate('labels')
        .populate('milestone');
};

issueSchema.statics.getNextNumber = async function(repoId) {
    const lastIssue = await this.findOne({ repository: repoId })
        .sort({ number: -1 })
        .select('number');
    return (lastIssue ? lastIssue.number : 0) + 1;
};

issueSchema.statics.getStats = async function(repoId) {
    const stats = await this.aggregate([
        { $match: { repository: repoId } },
        { $group: {
            _id: '$state',
            count: { $sum: 1 }
        }}
    ]);
    
    const result = { open: 0, closed: 0 };
    stats.forEach(stat => {
        result[stat._id] = stat.count;
    });
    return result;
};

// ===== دوال المثيل =====
issueSchema.methods.addComment = async function(commentId) {
    if (!this.comments.includes(commentId)) {
        this.comments.push(commentId);
        this.commentsCount += 1;
        this.updatedAt = Date.now();
    }
    return this.save();
};

issueSchema.methods.removeComment = async function(commentId) {
    this.comments = this.comments.filter(id => id.toString() !== commentId.toString());
    this.commentsCount = Math.max(0, this.commentsCount - 1);
    this.updatedAt = Date.now();
    return this.save();
};

issueSchema.methods.close = async function(userId) {
    this.state = 'closed';
    this.closedAt = Date.now();
    this.closedBy = userId;
    this.updatedAt = Date.now();
    return this.save();
};

issueSchema.methods.reopen = async function() {
    this.state = 'open';
    this.closedAt = undefined;
    this.closedBy = undefined;
    this.updatedAt = Date.now();
    return this.save();
};

issueSchema.methods.addLabel = function(label) {
    if (!this.labels.some(l => l.name === label.name)) {
        this.labels.push(label);
        this.updatedAt = Date.now();
    }
    return this.save();
};

issueSchema.methods.removeLabel = function(labelName) {
    this.labels = this.labels.filter(l => l.name !== labelName);
    this.updatedAt = Date.now();
    return this.save();
};

issueSchema.methods.assign = function(userId) {
    if (!this.assignees.includes(userId)) {
        this.assignees.push(userId);
        this.updatedAt = Date.now();
    }
    return this.save();
};

issueSchema.methods.unassign = function(userId) {
    this.assignees = this.assignees.filter(id => id.toString() !== userId.toString());
    this.updatedAt = Date.now();
    return this.save();
};

issueSchema.methods.toggleLock = function() {
    this.locked = !this.locked;
    this.updatedAt = Date.now();
    return this.save();
};

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;