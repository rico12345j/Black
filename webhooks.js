// ============================================================
// ===== WEBHOOKS ROUTES — مسارات Webhooks =====
// ============================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Repository = require('../models/Repository');
const Issue = require('../models/Issue');
const PullRequest = require('../models/PullRequest');
const { logger } = require('../middleware/logger');

// ===== استقبال Webhook من GitHub =====
router.post('/github', async (req, res) => {
    try {
        const event = req.headers['x-github-event'];
        const signature = req.headers['x-hub-signature-256'];
        const payload = req.body;
        
        logger.info(`📨 استقبال Webhook: ${event} من ${payload.repository?.full_name}`);
        
        switch (event) {
            case 'push':
                await handlePushEvent(payload);
                break;
            case 'issues':
                await handleIssueEvent(payload);
                break;
            case 'pull_request':
                await handlePullRequestEvent(payload);
                break;
            case 'star':
                await handleStarEvent(payload);
                break;
            case 'watch':
                await handleWatchEvent(payload);
                break;
            case 'fork':
                await handleForkEvent(payload);
                break;
            case 'create':
                await handleCreateEvent(payload);
                break;
            case 'delete':
                await handleDeleteEvent(payload);
                break;
            default:
                logger.info(`⚠️ حدث غير معروف: ${event}`);
        }
        
        res.json({
            success: true,
            message: 'تم استقبال Webhook بنجاح'
        });
    } catch (error) {
        logger.error('❌ فشل معالجة Webhook:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء معالجة Webhook'
        });
    }
});

// ===== معالجة حدث Push =====
async function handlePushEvent(payload) {
    const repo = await Repository.findOne({
        name: payload.repository.name,
        owner: payload.repository.owner.login
    });
    
    if (repo) {
        repo.lastCommitAt = new Date();
        await repo.save();
        logger.info(`✅ تحديث مستودع ${repo.name} - ${payload.commits?.length || 0} commits`);
    }
}

// ===== معالجة حدث Issues =====
async function handleIssueEvent(payload) {
    const action = payload.action;
    const issueData = payload.issue;
    
    // البحث عن القضية في قاعدة البيانات
    const issue = await Issue.findOne({
        number: issueData.number,
        repository: payload.repository.id
    });
    
    if (issue) {
        if (action === 'closed') {
            await issue.close(payload.sender.id);
        } else if (action === 'reopened') {
            await issue.reopen();
        }
        logger.info(`✅ قضية ${action}: #${issue.number}`);
    }
}

// ===== معالجة حدث Pull Request =====
async function handlePullRequestEvent(payload) {
    const action = payload.action;
    const pullData = payload.pull_request;
    
    const pull = await PullRequest.findOne({
        number: pullData.number,
        repository: payload.repository.id
    });
    
    if (pull) {
        if (action === 'closed') {
            await pull.close(payload.sender.id);
        } else if (action === 'opened') {
            // تحديث الحالة
        }
        logger.info(`✅ طلب سحب ${action}: #${pull.number}`);
    }
}

// ===== معالجة حدث Star =====
async function handleStarEvent(payload) {
    const action = payload.action;
    const repo = payload.repository;
    logger.info(`✅ نجمة ${action}: ${repo.full_name}`);
}

// ===== معالجة حدث Watch =====
async function handleWatchEvent(payload) {
    const action = payload.action;
    const repo = payload.repository;
    logger.info(`✅ متابعة ${action}: ${repo.full_name}`);
}

// ===== معالجة حدث Fork =====
async function handleForkEvent(payload) {
    const repo = payload.repository;
    const forkee = payload.forkee;
    logger.info(`✅ نسخ: ${repo.full_name} -> ${forkee.full_name}`);
}

// ===== معالجة حدث Create =====
async function handleCreateEvent(payload) {
    const refType = payload.ref_type;
    const ref = payload.ref;
    const repo = payload.repository;
    logger.info(`✅ إنشاء ${refType}: ${ref} في ${repo.full_name}`);
}

// ===== معالجة حدث Delete =====
async function handleDeleteEvent(payload) {
    const refType = payload.ref_type;
    const ref = payload.ref;
    const repo = payload.repository;
    logger.info(`✅ حذف ${refType}: ${ref} من ${repo.full_name}`);
}

// ===== Webhook للاختبار =====
router.post('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Webhook test successful',
        received: req.body
    });
});

module.exports = router;