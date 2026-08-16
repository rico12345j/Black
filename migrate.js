// ============================================================
// ===== MIGRATE SCRIPT — ترحيل قاعدة البيانات =====
// ============================================================

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ===== استيراد النماذج =====
const User = require('../models/User');
const Repository = require('../models/Repository');
const Issue = require('../models/Issue');
const PullRequest = require('../models/PullRequest');
const Comment = require('../models/Comment');

// ===== تحميل متغيرات البيئة =====
require('dotenv').config();

// ===== إعدادات =====
const MIGRATION_DIR = path.join(__dirname, '../../migrations');
const BACKUP_DIR = path.join(__dirname, '../../backups');

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

// ===== إنشاء المجلدات =====
const createDirectories = () => {
    if (!fs.existsSync(MIGRATION_DIR)) {
        fs.mkdirSync(MIGRATION_DIR, { recursive: true });
        console.log('📁 تم إنشاء مجلد الترحيلات');
    }
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log('📁 تم إنشاء مجلد النسخ الاحتياطي');
    }
};

// ===== إنشاء ترحيلة جديدة =====
const createMigration = (name) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}_${name}.js`;
    const filePath = path.join(MIGRATION_DIR, fileName);
    
    const template = `
// ============================================================
// ===== MIGRATION: ${name} =====
// ===== التاريخ: ${new Date().toISOString()} =====
// ============================================================

const mongoose = require('mongoose');

// ===== الترقية =====
const up = async () => {
    console.log('⬆️ جاري تطبيق الترحيلة: ${name}');
    
    // TODO: أضف كود الترقية هنا
    
    console.log('✅ تم تطبيق الترحيلة بنجاح');
};

// ===== التراجع =====
const down = async () => {
    console.log('⬇️ جاري التراجع عن الترحيلة: ${name}');
    
    // TODO: أضف كود التراجع هنا
    
    console.log('✅ تم التراجع عن الترحيلة بنجاح');
};

// ===== تصدير =====
module.exports = { up, down };
`;
    
    fs.writeFileSync(filePath, template);
    console.log(`✅ تم إنشاء الترحيلة: ${fileName}`);
    return filePath;
};

// ===== تنفيذ الترحيلات =====
const runMigrations = async (direction = 'up') => {
    console.log(`🔄 جاري تنفيذ الترحيلات (${direction})...`);
    
    const files = fs.readdirSync(MIGRATION_DIR)
        .filter(f => f.endsWith('.js'))
        .sort();
    
    if (files.length === 0) {
        console.log('📭 لا توجد ترحيلات للتنفيذ');
        return;
    }
    
    for (const file of files) {
        const filePath = path.join(MIGRATION_DIR, file);
        const migration = require(filePath);
        
        if (direction === 'up' && migration.up) {
            await migration.up();
        } else if (direction === 'down' && migration.down) {
            await migration.down();
        }
    }
    
    console.log(`✅ تم تنفيذ الترحيلات (${direction}) بنجاح`);
};

// ===== إنشاء نسخة احتياطية =====
const createBackup = async () => {
    console.log('💾 جاري إنشاء نسخة احتياطية...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
    
    const data = {
        timestamp: new Date().toISOString(),
        collections: {}
    };
    
    // تصدير جميع المجموعات
    const collections = ['users', 'repositories', 'issues', 'pullrequests', 'comments'];
    for (const collection of collections) {
        const model = mongoose.models[collection.charAt(0).toUpperCase() + collection.slice(1)];
        if (model) {
            const docs = await model.find({});
            data.collections[collection] = docs;
        }
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    console.log(`✅ تم إنشاء النسخة الاحتياطية: ${backupFile}`);
    return backupFile;
};

// ===== استعادة نسخة احتياطية =====
const restoreBackup = async (backupFile) => {
    console.log(`🔄 جاري استعادة النسخة الاحتياطية: ${backupFile}`);
    
    if (!fs.existsSync(backupFile)) {
        console.error(`❌ ملف النسخة الاحتياطية غير موجود: ${backupFile}`);
        return;
    }
    
    const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // حذف البيانات الحالية
    await User.deleteMany({});
    await Repository.deleteMany({});
    await Issue.deleteMany({});
    await PullRequest.deleteMany({});
    await Comment.deleteMany({});
    
    // استعادة البيانات
    for (const [collection, docs] of Object.entries(data.collections)) {
        const model = mongoose.models[collection.charAt(0).toUpperCase() + collection.slice(1)];
        if (model && docs.length > 0) {
            await model.insertMany(docs);
            console.log(`   ✅ استعادة ${collection}: ${docs.length} وثيقة`);
        }
    }
    
    console.log('✅ تم استعادة النسخة الاحتياطية بنجاح');
};

// ===== الدالة الرئيسية =====
const migrate = async () => {
    try {
        console.log('🚀 بدء عملية الترحيل...');
        console.log('========================================');
        
        await connectDB();
        createDirectories();
        
        const args = process.argv.slice(2);
        const command = args[0] || 'help';
        
        switch (command) {
            case 'create':
                const name = args[1] || `migration_${Date.now()}`;
                createMigration(name);
                break;
                
            case 'up':
                await runMigrations('up');
                break;
                
            case 'down':
                await runMigrations('down');
                break;
                
            case 'backup':
                await createBackup();
                break;
                
            case 'restore':
                const backupFile = args[1] || '';
                await restoreBackup(backupFile);
                break;
                
            case 'status':
                const files = fs.readdirSync(MIGRATION_DIR)
                    .filter(f => f.endsWith('.js'))
                    .sort();
                console.log(`📋 الترحيلات (${files.length}):`);
                files.forEach(f => console.log(`   - ${f}`));
                break;
                
            default:
                console.log(`
📖 تعليمات استخدام سكريبت الترحيل:

  node scripts/migrate.js create <name>  - إنشاء ترحيلة جديدة
  node scripts/migrate.js up             - تطبيق جميع الترحيلات
  node scripts/migrate.js down           - التراجع عن جميع الترحيلات
  node scripts/migrate.js backup         - إنشاء نسخة احتياطية
  node scripts/migrate.js restore <file> - استعادة نسخة احتياطية
  node scripts/migrate.js status         - عرض حالة الترحيلات
                `);
                break;
        }
        
        console.log('========================================');
        process.exit(0);
    } catch (error) {
        console.error('❌ فشل الترحيل:', error);
        process.exit(1);
    }
};

// ===== تشغيل السكريبت =====
migrate();