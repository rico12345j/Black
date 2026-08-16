// ============================================================
// ===== GITHUB CLONE — MAIN SERVER =====
// ===== Version: ULTIMATE | D4 Architecture =====
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs');
const http = require('http');
const socketio = require('socket.io');

// ===== تحميل المتغيرات البيئية =====
dotenv.config();

// ===== استيراد المسارات =====
const authRoutes = require('./routes/auth');
const repoRoutes = require('./routes/repos');
const issueRoutes = require('./routes/issues');
const pullRoutes = require('./routes/pulls');
const userRoutes = require('./routes/users');
const searchRoutes = require('./routes/search');
const webhookRoutes = require('./routes/webhooks');

// ===== استيراد الـ Middleware =====
const { authMiddleware, optionalAuth } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/error');
const { logger } = require('./middleware/logger');

// ===== تهيئة التطبيق =====
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 5000;

// ===== إعدادات الأمان والحد =====
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100, // حد أقصى 100 طلب لكل IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: '⚠️ تم تجاوز الحد الأقصى للطلبات، حاول لاحقاً'
    }
});

// ===== Middleware =====
// الأمان
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://ui-avatars.com", "https://avatars.githubusercontent.com", "https://*.googleapis.com"],
            connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);

// ===== السجلات =====
app.use(morgan('combined', {
    stream: {
        write: (message) => {
            logger.info(message.trim());
        }
    }
}));

app.use(logger);

// ===== إعدادات الجلسة =====
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'github-clone-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/github-clone',
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60, // 14 يوم
        autoRemove: 'native'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 أيام
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
    }
};

if (process.env.NODE_ENV === 'production') {
    sessionConfig.cookie.secure = true;
    app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// ===== إعدادات Passport =====
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// ===== WebSocket =====
io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    logger.info(`🔌 عميل متصل: ${socket.id} (${clientIp})`);

    // الانضمام إلى غرفة المستودع
    socket.on('join-repo', (repoId) => {
        if (!repoId) return;
        socket.join(`repo-${repoId}`);
        logger.info(`📂 انضم إلى المستودع: ${repoId} (${socket.id})`);
    });

    socket.on('leave-repo', (repoId) => {
        if (!repoId) return;
        socket.leave(`repo-${repoId}`);
        logger.info(`📂 غادر المستودع: ${repoId} (${socket.id})`);
    });

    // الأحداث
    socket.on('new-issue', (data) => {
        if (!data || !data.repoId) return;
        io.to(`repo-${data.repoId}`).emit('issue-created', {
            ...data,
            timestamp: new Date().toISOString()
        });
        logger.info(`🐛 قضية جديدة: ${data.title} (${data.repoId})`);
    });

    socket.on('new-pull', (data) => {
        if (!data || !data.repoId) return;
        io.to(`repo-${data.repoId}`).emit('pull-created', {
            ...data,
            timestamp: new Date().toISOString()
        });
        logger.info(`🔀 طلب سحب جديد: ${data.title} (${data.repoId})`);
    });

    socket.on('new-comment', (data) => {
        if (!data || !data.repoId) return;
        io.to(`repo-${data.repoId}`).emit('comment-created', {
            ...data,
            timestamp: new Date().toISOString()
        });
        logger.info(`💬 تعليق جديد: ${data.body?.substring(0, 30)}... (${data.repoId})`);
    });

    socket.on('new-star', (data) => {
        if (!data || !data.repoId) return;
        io.to(`repo-${data.repoId}`).emit('star-updated', {
            ...data,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('typing', (data) => {
        if (!data || !data.repoId) return;
        socket.to(`repo-${data.repoId}`).emit('user-typing', {
            userId: data.userId,
            username: data.username,
            room: data.repoId
        });
    });

    socket.on('disconnect', () => {
        logger.info(`🔌 عميل غير متصل: ${socket.id}`);
    });

    socket.on('error', (error) => {
        logger.error(`❌ خطأ في WebSocket: ${error}`);
    });
});

// ===== مسارات API =====
app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/pulls', pullRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/webhooks', webhookRoutes);

// ===== مسار الصحة =====
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: require('../package.json').version
    });
});

// ===== مسارات الملفات الثابتة =====
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));

// ===== مسارات الصفحات =====
const sendFile = (file) => (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages', file));
};

// الصفحة الرئيسية
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../frontend/pages/dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
});

// صفحات المصادقة
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

app.get('/signup', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../frontend/pages/signup.html'));
});

// صفحات التطبيق
app.get('/dashboard', authMiddleware, sendFile('dashboard.html'));
app.get('/explore', authMiddleware, sendFile('explore.html'));
app.get('/trending', authMiddleware, sendFile('trending.html'));
app.get('/notifications', authMiddleware, sendFile('notifications.html'));
app.get('/settings', authMiddleware, sendFile('settings.html'));
app.get('/copilot', authMiddleware, sendFile('copilot.html'));
app.get('/actions', authMiddleware, sendFile('actions.html'));
app.get('/security', authMiddleware, sendFile('security.html'));
app.get('/resources', authMiddleware, sendFile('resources.html'));
app.get('/pricing', authMiddleware, sendFile('pricing.html'));

// صفحات المستخدم والمستودع
app.get('/:username', async (req, res) => {
    try {
        const User = require('./models/User');
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
        }
        res.sendFile(path.join(__dirname, '../frontend/pages/profile.html'));
    } catch {
        res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
    }
});

app.get('/:username/:repo', async (req, res) => {
    try {
        const User = require('./models/User');
        const Repository = require('./models/Repository');
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
        }
        const repo = await Repository.findOne({
            name: req.params.repo,
            owner: user._id
        });
        if (!repo) {
            return res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
        }
        res.sendFile(path.join(__dirname, '../frontend/pages/repo.html'));
    } catch {
        res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
    }
});

app.get('/:username/:repo/code', sendFile('code.html'));
app.get('/:username/:repo/issues', sendFile('issues.html'));
app.get('/:username/:repo/pulls', sendFile('pulls.html'));
app.get('/:username/:repo/projects', sendFile('projects.html'));
app.get('/:username/:repo/wiki', sendFile('wiki.html'));
app.get('/:username/:repo/actions', sendFile('actions.html'));
app.get('/:username/:repo/settings', sendFile('repo-settings.html'));

// صفحة 404
app.get('/404', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
});

// ===== معالجة الأخطاء =====
app.use(notFound);
app.use(errorHandler);

// ===== الاتصال بقاعدة البيانات =====
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/github-clone', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
})
.then(() => {
    logger.info('✅ متصل بقاعدة البيانات MongoDB');
})
.catch(err => {
    logger.error(`❌ فشل الاتصال بقاعدة البيانات: ${err.message}`);
    process.exit(1);
});

// ===== إنشاء المجلدات =====
const dirs = ['logs', 'uploads', 'temp', 'backups', 'migrations'];
dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`📁 تم إنشاء المجلد: ${dir}`);
    }
});

// ===== تشغيل الخادم =====
server.listen(PORT, () => {
    logger.info('========================================');
    logger.info('🐙 GITHUB CLONE');
    logger.info('🚀 D4 Ultimate Architecture');
    logger.info(`📡 الخادم يعمل على http://localhost:${PORT}`);
    logger.info(`🔌 WebSocket يعمل على ws://localhost:${PORT}`);
    logger.info(`🔄 الوضع: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📦 الإصدار: ${require('../package.json').version}`);
    logger.info('========================================');
});

// ===== معالجة الإيقاف =====
process.on('SIGTERM', () => {
    logger.info('🛑 استلام إشارة الإيقاف، جاري الإغلاق...');
    server.close(() => {
        logger.info('✅ تم إغلاق الخادم');
        mongoose.connection.close(false, () => {
            logger.info('✅ تم إغلاق قاعدة البيانات');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    logger.info('🛑 استلام إشارة المقاطعة، جاري الإغلاق...');
    server.close(() => {
        logger.info('✅ تم إغلاق الخادم');
        mongoose.connection.close(false, () => {
            logger.info('✅ تم إغلاق قاعدة البيانات');
            process.exit(0);
        });
    });
});

// ===== معالجة الأخطاء غير المتوقعة =====
process.on('uncaughtException', (error) => {
    logger.error(`❌ استثناء غير متوقع: ${error.message}`);
    logger.error(error.stack);
    // لا نغلق الخادم هنا، نتركه يعمل
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`❌ رفض غير متوقع: ${reason}`);
});

// ===== تصدير =====
module.exports = { app, server, io };