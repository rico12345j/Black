// ============================================================
// ===== DATABASE CONFIG — إعدادات قاعدة البيانات =====
// ============================================================

const mongoose = require('mongoose');
const { logger } = require('../middleware/logger');

// ===== خيارات الاتصال =====
const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // استخدام IPv4
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 10000,
    retryWrites: true,
    w: 'majority'
};

// ===== متغيرات الاتصال =====
let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

// ===== دالة الاتصال بقاعدة البيانات =====
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/github-clone';
        
        logger.info(`🔄 جاري الاتصال بقاعدة البيانات: ${mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
        
        const conn = await mongoose.connect(mongoURI, connectionOptions);
        
        isConnected = true;
        connectionAttempts = 0;
        
        logger.info(`✅ متصل بقاعدة البيانات: ${conn.connection.host}`);
        logger.info(`📊 اسم قاعدة البيانات: ${conn.connection.name}`);
        logger.info(`📦 عدد المجموعات: ${Object.keys(conn.connection.collections).length}`);
        
        // إضافة مستمعين للأحداث
        mongoose.connection.on('error', handleConnectionError);
        mongoose.connection.on('disconnected', handleDisconnection);
        mongoose.connection.on('reconnected', handleReconnection);
        
        return conn;
    } catch (error) {
        logger.error(`❌ فشل الاتصال بقاعدة البيانات: ${error.message}`);
        connectionAttempts++;
        
        if (connectionAttempts < MAX_RETRIES) {
            logger.info(`🔄 محاولة إعادة الاتصال (${connectionAttempts}/${MAX_RETRIES}) بعد ${RETRY_DELAY}ms...`);
            setTimeout(connectDB, RETRY_DELAY);
        } else {
            logger.error('❌ فشل الاتصال بقاعدة البيانات بعد عدة محاولات');
            process.exit(1);
        }
    }
};

// ===== معالجة أخطاء الاتصال =====
const handleConnectionError = (error) => {
    logger.error(`❌ خطأ في اتصال قاعدة البيانات: ${error.message}`);
    isConnected = false;
    
    // محاولة إعادة الاتصال التلقائي
    if (connectionAttempts < MAX_RETRIES) {
        setTimeout(connectDB, RETRY_DELAY);
    }
};

// ===== معالجة انقطاع الاتصال =====
const handleDisconnection = () => {
    logger.warning('⚠️ انقطع الاتصال بقاعدة البيانات');
    isConnected = false;
    
    // محاولة إعادة الاتصال
    if (connectionAttempts < MAX_RETRIES) {
        setTimeout(connectDB, RETRY_DELAY);
    }
};

// ===== معالجة إعادة الاتصال =====
const handleReconnection = () => {
    logger.info('🔄 تم إعادة الاتصال بقاعدة البيانات');
    isConnected = true;
    connectionAttempts = 0;
};

// ===== دالة قطع الاتصال =====
const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        isConnected = false;
        logger.info('⛔ تم قطع الاتصال بقاعدة البيانات');
    } catch (error) {
        logger.error(`❌ فشل قطع الاتصال: ${error.message}`);
    }
};

// ===== دالة التحقق من حالة الاتصال =====
const getConnectionStatus = () => {
    return {
        isConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        models: Object.keys(mongoose.models),
        collections: Object.keys(mongoose.connection.collections)
    };
};

// ===== دالة الحصول على إحصائيات قاعدة البيانات =====
const getDBStats = async () => {
    try {
        const stats = await mongoose.connection.db.stats();
        return {
            collections: stats.collections,
            objects: stats.objects,
            avgObjSize: stats.avgObjSize,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            indexSize: stats.indexSize,
            fileSize: stats.fileSize
        };
    } catch (error) {
        logger.error(`❌ فشل الحصول على إحصائيات قاعدة البيانات: ${error.message}`);
        return null;
    }
};

// ===== دالة حذف جميع المجموعات (للاستخدام في الاختبارات) =====
const dropDatabase = async () => {
    try {
        await mongoose.connection.dropDatabase();
        logger.info('🗑️ تم حذف قاعدة البيانات');
    } catch (error) {
        logger.error(`❌ فشل حذف قاعدة البيانات: ${error.message}`);
    }
};

// ===== إعداد المؤشرات =====
const setupIndexes = async () => {
    try {
        // إنشاء المؤشرات لجميع النماذج
        const models = mongoose.models;
        for (const modelName in models) {
            const model = models[modelName];
            if (model.schema && typeof model.schema.indexes === 'function') {
                const indexes = await model.schema.indexes();
                if (indexes && indexes.length > 0) {
                    logger.info(`📊 إنشاء المؤشرات للنموذج ${modelName}: ${indexes.length} مؤشر`);
                }
            }
        }
        logger.info('✅ تم إنشاء المؤشرات بنجاح');
    } catch (error) {
        logger.error(`❌ فشل إنشاء المؤشرات: ${error.message}`);
    }
};

// ===== دالة تهيئة قاعدة البيانات =====
const initDB = async () => {
    try {
        await connectDB();
        
        // إنشاء المؤشرات
        await setupIndexes();
        
        // عرض حالة الاتصال
        const status = getConnectionStatus();
        logger.info('📊 حالة قاعدة البيانات:', status);
        
        return status;
    } catch (error) {
        logger.error(`❌ فشل تهيئة قاعدة البيانات: ${error.message}`);
        throw error;
    }
};

// ===== تصدير الدوال =====
module.exports = {
    connectDB,
    disconnectDB,
    getConnectionStatus,
    getDBStats,
    dropDatabase,
    setupIndexes,
    initDB,
    connectionOptions,
    isConnected: () => isConnected
};