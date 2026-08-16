// ============================================================
// ===== SEED SCRIPT — تعبئة قاعدة البيانات =====
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');

// ===== استيراد النماذج =====
const User = require('../models/User');
const Repository = require('../models/Repository');
const Issue = require('../models/Issue');
const PullRequest = require('../models/PullRequest');
const Comment = require('../models/Comment');

// ===== تحميل متغيرات البيئة =====
require('dotenv').config();

// ===== إعدادات =====
const SEED_CONFIG = {
    users: parseInt(process.env.SEED_USERS) || 20,
    reposPerUser: parseInt(process.env.SEED_REPOS_PER_USER) || 3,
    issuesPerRepo: parseInt(process.env.SEED_ISSUES_PER_REPO) || 5,
    pullsPerRepo: parseInt(process.env.SEED_PULLS_PER_REPO) || 3,
    commentsPerIssue: parseInt(process.env.SEED_COMMENTS_PER_ISSUE) || 3,
    commentsPerPull: parseInt(process.env.SEED_COMMENTS_PER_PULL) || 2
};

// ===== الاتصال بقاعدة البيانات =====
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/github-clone';
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ متصل بقاعدة البيانات');
    } catch (error) {
        console.error('❌ فشل الاتصال بقاعدة البيانات:', error);
        process.exit(1);
    }
};

// ===== إنشاء مستخدمين وهميين =====
const seedUsers = async (count) => {
    console.log(`👤 إنشاء ${count} مستخدم...`);
    const users = [];
    
    for (let i = 0; i < count; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const username = faker.internet.userName({ firstName, lastName }).toLowerCase();
        
        const user = new User({
            username,
            email: faker.internet.email({ firstName, lastName }),
            password: await bcrypt.hash('password123', 12),
            name: faker.person.fullName({ firstName, lastName }),
            bio: faker.person.bio(),
            location: faker.location.city(),
            website: faker.internet.url(),
            company: faker.company.name(),
            isEmailVerified: true,
            isVerified: Math.random() > 0.7,
            isHireable: Math.random() > 0.6,
            avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=random&size=128`,
            contributions: {
                total: faker.number.int({ min: 0, max: 1000 }),
                lastYear: faker.number.int({ min: 0, max: 500 }),
                lastMonth: faker.number.int({ min: 0, max: 100 }),
                lastWeek: faker.number.int({ min: 0, max: 20 })
            }
        });
        
        await user.save();
        users.push(user);
        console.log(`   ✅ تم إنشاء المستخدم: ${username}`);
    }
    
    return users;
};

// ===== إنشاء مستودعات وهمية =====
const seedRepositories = async (users, reposPerUser) => {
    console.log(`📂 إنشاء مستودعات...`);
    const repos = [];
    const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'Ruby', 'PHP', 'Swift'];
    const licenses = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'Unlicense'];
    const topics = ['web', 'api', 'database', 'framework', 'library', 'cli', 'automation', 'machine-learning', 'devops', 'security'];
    
    for (const user of users) {
        for (let i = 0; i < faker.number.int({ min: 1, max: reposPerUser }); i++) {
            const repoName = faker.git.branch().toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const isPublic = Math.random() > 0.2;
            const language = faker.helpers.arrayElement(languages);
            
            const repo = new Repository({
                name: repoName,
                description: faker.lorem.sentence({ min: 3, max: 10 }),
                owner: user._id,
                isPublic,
                isTemplate: Math.random() > 0.8,
                isArchived: Math.random() > 0.9,
                language,
                license: faker.helpers.arrayElement(licenses),
                topics: faker.helpers.arrayElements(topics, { min: 0, max: 4 }),
                stars: faker.number.int({ min: 0, max: 1000 }),
                watchers: faker.number.int({ min: 0, max: 100 }),
                forks: faker.number.int({ min: 0, max: 200 }),
                branches: [
                    { name: 'main', protected: true },
                    { name: 'develop', protected: false },
                    { name: `feature/${faker.git.branch()}`, protected: false }
                ],
                commits: Array.from({ length: faker.number.int({ min: 5, max: 50 }) }, () => ({
                    hash: faker.git.commitSha(),
                    message: faker.git.commitMessage(),
                    author: user._id,
                    date: faker.date.past({ years: 1 }),
                    files: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => faker.system.filePath()),
                    additions: faker.number.int({ min: 1, max: 500 }),
                    deletions: faker.number.int({ min: 0, max: 100 })
                }))
            });
            
            await repo.save();
            repos.push(repo);
            console.log(`   ✅ تم إنشاء المستودع: ${user.username}/${repoName}`);
        }
    }
    
    return repos;
};

// ===== إنشاء قضايا وهمية =====
const seedIssues = async (repos, issuesPerRepo) => {
    console.log(`🐛 إنشاء قضايا...`);
    const issues = [];
    const labels = [
        { name: 'bug', color: 'd73a4a', description: 'Something isn\'t working' },
        { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
        { name: 'documentation', color: '0075ca', description: 'Improvements or additions to documentation' },
        { name: 'good first issue', color: '7057ff', description: 'Good for newcomers' },
        { name: 'help wanted', color: '008672', description: 'Extra attention is needed' },
        { name: 'question', color: 'd876e3', description: 'Further information is requested' }
    ];
    
    for (const repo of repos) {
        for (let i = 0; i < faker.number.int({ min: 0, max: issuesPerRepo }); i++) {
            const number = await Issue.getNextNumber(repo._id);
            const isOpen = Math.random() > 0.3;
            
            const issue = new Issue({
                number,
                title: faker.lorem.sentence({ min: 3, max: 8 }),
                body: faker.lorem.paragraphs({ min: 1, max: 3 }),
                repository: repo._id,
                author: repo.owner,
                state: isOpen ? 'open' : 'closed',
                labels: faker.helpers.arrayElements(labels, { min: 0, max: 2 }),
                assignees: faker.helpers.arrayElements([repo.owner], { min: 0, max: 1 }),
                createdAt: faker.date.past({ years: 1 }),
                updatedAt: faker.date.recent()
            });
            
            if (!isOpen) {
                issue.closedAt = faker.date.recent();
                issue.closedBy = repo.owner;
            }
            
            await issue.save();
            issues.push(issue);
            
            // تحديث عدد القضايا في المستودع
            await Repository.findByIdAndUpdate(repo._id, {
                $inc: { issues: 1 }
            });
            
            console.log(`   ✅ تم إنشاء القضية #${number} في ${repo.name}`);
        }
    }
    
    return issues;
};

// ===== إنشاء طلبات سحب وهمية =====
const seedPullRequests = async (repos, pullsPerRepo) => {
    console.log(`🔀 إنشاء طلبات سحب...`);
    const pulls = [];
    
    for (const repo of repos) {
        for (let i = 0; i < faker.number.int({ min: 0, max: pullsPerRepo }); i++) {
            const number = await PullRequest.getNextNumber(repo._id);
            const state = faker.helpers.arrayElement(['open', 'merged', 'closed']);
            
            const pull = new PullRequest({
                number,
                title: faker.lorem.sentence({ min: 3, max: 8 }),
                body: faker.lorem.paragraphs({ min: 0, max: 2 }),
                repository: repo._id,
                author: repo.owner,
                baseBranch: 'main',
                headBranch: `feature/${faker.git.branch()}`,
                state,
                draft: state === 'open' && Math.random() > 0.5,
                createdAt: faker.date.past({ years: 1 }),
                updatedAt: faker.date.recent()
            });
            
            if (state === 'merged') {
                pull.mergedAt = faker.date.recent();
                pull.mergedBy = repo.owner;
            }
            
            await pull.save();
            pulls.push(pull);
            
            await Repository.findByIdAndUpdate(repo._id, {
                $inc: { pullRequests: 1 }
            });
            
            console.log(`   ✅ تم إنشاء طلب سحب #${number} في ${repo.name}`);
        }
    }
    
    return pulls;
};

// ===== إنشاء تعليقات وهمية =====
const seedComments = async (issues, pulls, commentsPerIssue, commentsPerPull) => {
    console.log(`💬 إنشاء تعليقات...`);
    let commentCount = 0;
    
    // تعليقات على القضايا
    for (const issue of issues) {
        for (let i = 0; i < faker.number.int({ min: 0, max: commentsPerIssue }); i++) {
            const comment = new Comment({
                body: faker.lorem.paragraphs({ min: 1, max: 2 }),
                author: issue.author,
                repository: issue.repository,
                issue: issue._id,
                createdAt: faker.date.between({ from: issue.createdAt, to: issue.updatedAt || new Date() })
            });
            
            await comment.save();
            await issue.addComment(comment._id);
            commentCount++;
        }
    }
    
    // تعليقات على طلبات السحب
    for (const pull of pulls) {
        for (let i = 0; i < faker.number.int({ min: 0, max: commentsPerPull }); i++) {
            const comment = new Comment({
                body: faker.lorem.paragraphs({ min: 1, max: 2 }),
                author: pull.author,
                repository: pull.repository,
                pullRequest: pull._id,
                createdAt: faker.date.between({ from: pull.createdAt, to: pull.updatedAt || new Date() })
            });
            
            await comment.save();
            await pull.addComment(comment._id);
            commentCount++;
        }
    }
    
    console.log(`   ✅ تم إنشاء ${commentCount} تعليق`);
};

// ===== الدالة الرئيسية =====
const seed = async () => {
    try {
        console.log('🚀 بدء تعبئة قاعدة البيانات...');
        console.log('========================================');
        
        await connectDB();
        
        // حذف البيانات الموجودة
        console.log('🗑️ حذف البيانات القديمة...');
        await User.deleteMany({});
        await Repository.deleteMany({});
        await Issue.deleteMany({});
        await PullRequest.deleteMany({});
        await Comment.deleteMany({});
        
        console.log('========================================');
        
        // إنشاء البيانات
        const users = await seedUsers(SEED_CONFIG.users);
        const repos = await seedRepositories(users, SEED_CONFIG.reposPerUser);
        const issues = await seedIssues(repos, SEED_CONFIG.issuesPerRepo);
        const pulls = await seedPullRequests(repos, SEED_CONFIG.pullsPerRepo);
        await seedComments(issues, pulls, SEED_CONFIG.commentsPerIssue, SEED_CONFIG.commentsPerPull);
        
        console.log('========================================');
        console.log('✅ تم تعبئة قاعدة البيانات بنجاح!');
        console.log(`📊 الإحصائيات:`);
        console.log(`   👤 المستخدمون: ${users.length}`);
        console.log(`   📂 المستودعات: ${repos.length}`);
        console.log(`   🐛 القضايا: ${issues.length}`);
        console.log(`   🔀 طلبات السحب: ${pulls.length}`);
        console.log('========================================');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ فشل تعبئة قاعدة البيانات:', error);
        process.exit(1);
    }
};

// ===== تشغيل السكريبت =====
seed();