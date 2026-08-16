// ============================================================
// ===== REPO SCRIPT — سكريبت المستودع =====
// ============================================================

// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('📂 Repository — جاهز');
    
    loadRepoData();
    initFileTree();
    initBranchSelector();
    initCodeViewer();
    initStarButton();
    initWatchButton();
    initForkButton();
});

// ===== تحميل بيانات المستودع =====
async function loadRepoData() {
    try {
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p);
        const username = parts[0];
        const repoName = parts[1];
        
        if (!username || !repoName) return;
        
        // تحميل بيانات المستودع
        const response = await fetch(`/api/repos/${repoName}`);
        const data = await response.json();
        
        if (data.success) {
            displayRepoInfo(data.repo);
        }
    } catch (error) {
        console.error('❌ فشل تحميل بيانات المستودع:', error);
    }
}

// ===== عرض معلومات المستودع =====
function displayRepoInfo(repo) {
    // تحديث العنوان
    document.title = `${repo.name} · ${repo.owner?.username} / GitHub Clone`;
    
    // تحديث اسم المستودع
    document.querySelector('.repo-name-header').textContent = repo.name;
    document.querySelector('.repo-full-name').textContent = `${repo.owner?.username} / ${repo.name}`;
    
    // تحديث الوصف
    const description = document.querySelector('.repo-description');
    if (repo.description) {
        description.textContent = repo.description;
        description.style.display = 'block';
    } else {
        description.style.display = 'none';
    }
    
    // تحديث الإحصائيات
    document.querySelector('.repo-stars-count').textContent = formatNumber(repo.stars || 0);
    document.querySelector('.repo-forks-count').textContent = formatNumber(repo.forks || 0);
    document.querySelector('.repo-watchers-count').textContent = formatNumber(repo.watchers || 0);
    document.querySelector('.repo-issues-count').textContent = formatNumber(repo.issues || 0);
    document.querySelector('.repo-pulls-count').textContent = formatNumber(repo.pullRequests || 0);
    
    // تحديث اللغة
    if (repo.language) {
        document.querySelector('.repo-language').textContent = repo.language;
    }
    
    // تحديث الترخيص
    if (repo.license) {
        document.querySelector('.repo-license').textContent = repo.license;
    }
    
    // تحديث آخر تحديث
    document.querySelector('.repo-updated').textContent = timeAgo(repo.updatedAt);
}

// ===== تهيئة شجرة الملفات =====
function initFileTree() {
    const treeContainer = document.getElementById('fileTree');
    if (!treeContainer) return;
    
    // بيانات وهمية لشجرة الملفات
    const files = [
        { name: 'README.md', type: 'file', icon: 'fa-file-alt' },
        { name: 'package.json', type: 'file', icon: 'fa-file-code' },
        { name: 'src', type: 'folder', icon: 'fa-folder', children: [
            { name: 'index.js', type: 'file', icon: 'fa-file-code' },
            { name: 'utils.js', type: 'file', icon: 'fa-file-code' },
            { name: 'components', type: 'folder', icon: 'fa-folder', children: [
                { name: 'App.js', type: 'file', icon: 'fa-file-code' },
                { name: 'Header.js', type: 'file', icon: 'fa-file-code' }
            ]}
        ]},
        { name: 'tests', type: 'folder', icon: 'fa-folder', children: [
            { name: 'app.test.js', type: 'file', icon: 'fa-file-code' }
        ]}
    ];
    
    treeContainer.innerHTML = renderFileTree(files);
}

// ===== عرض شجرة الملفات =====
function renderFileTree(files, level = 0) {
    let html = '<ul class="file-tree">';
    
    files.forEach(file => {
        const padding = level * 16;
        const isFolder = file.type === 'folder';
        
        html += `
            <li class="file-tree-item ${isFolder ? 'folder' : 'file'}" style="padding-right: ${padding}px;">
                <div class="file-tree-item-content" onclick="${isFolder ? `toggleFolder(this)` : `openFile('${file.name}')`}">
                    <i class="fas ${isFolder ? 'fa-folder' : file.icon || 'fa-file'}"></i>
                    <span>${file.name}</span>
                </div>
                ${isFolder && file.children ? renderFileTree(file.children, level + 1) : ''}
            </li>
        `;
    });
    
    html += '</ul>';
    return html;
}

// ===== تبديل المجلد =====
function toggleFolder(element) {
    const item = element.closest('.file-tree-item');
    if (!item) return;
    
    const childList = item.querySelector(':scope > ul');
    if (!childList) return;
    
    const icon = element.querySelector('.fa-folder, .fa-folder-open');
    if (icon) {
        icon.className = childList.style.display === 'none' ? 'fas fa-folder-open' : 'fas fa-folder';
    }
    
    childList.style.display = childList.style.display === 'none' ? 'block' : 'none';
}

// ===== فتح ملف =====
function openFile(filename) {
    console.log(`📄 فتح الملف: ${filename}`);
    // عرض محتوى الملف في محرر الكود
    showCodeViewer(filename);
}

// ===== عرض محتوى الكود =====
function showCodeViewer(filename) {
    const viewer = document.getElementById('codeViewer');
    if (!viewer) return;
    
    // بيانات وهمية
    const content = `// ${filename}\n\nfunction hello() {\n    console.log("Hello, World!");\n}\n\nhello();`;
    
    viewer.innerHTML = `
        <div class="code-header">
            <span class="code-filename">${filename}</span>
            <button class="btn btn-outline btn-small" onclick="copyCode()">
                <i class="fas fa-copy"></i> نسخ
            </button>
        </div>
        <pre class="code-content"><code>${escapeHtml(content)}</code></pre>
    `;
}

// ===== نسخ الكود =====
function copyCode() {
    const code = document.querySelector('.code-content code');
    if (!code) return;
    
    navigator.clipboard.writeText(code.textContent).then(() => {
        showNotification('📋 تم نسخ الكود');
    }).catch(() => {
        // طريقة بديلة
        const range = document.createRange();
        range.selectNode(code);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        showNotification('📋 تم نسخ الكود');
    });
}

// ===== تهيئة اختيار الفرع =====
function initBranchSelector() {
    const selector = document.getElementById('branchSelector');
    if (!selector) return;
    
    const branches = ['main', 'develop', 'feature/new-feature', 'hotfix/bug-fix'];
    
    selector.innerHTML = branches.map(branch => `
        <option value="${branch}" ${branch === 'main' ? 'selected' : ''}>${branch}</option>
    `).join('');
}

// ===== تهيئة زر النجمة =====
function initStarButton() {
    const button = document.getElementById('starButton');
    if (!button) return;
    
    button.addEventListener('click', async function() {
        const repoId = this.dataset.repoId;
        if (!repoId) return;
        
        const isStarred = this.classList.contains('starred');
        const method = isStarred ? 'DELETE' : 'POST';
        
        try {
            const response = await fetch(`/api/repos/${repoId}/star`, { method });
            const data = await response.json();
            
            if (data.success) {
                this.classList.toggle('starred');
                const count = document.querySelector('.repo-stars-count');
                if (count) {
                    const current = parseInt(count.textContent.replace(/[^0-9]/g, '')) || 0;
                    count.textContent = formatNumber(current + (isStarred ? -1 : 1));
                }
                showNotification(isStarred ? '⭐ تم إزالة النجمة' : '⭐ تم إضافة نجمة');
            }
        } catch (error) {
            console.error('❌ فشل تحديث النجمة:', error);
        }
    });
}

// ===== تهيئة زر المتابعة =====
function initWatchButton() {
    const button = document.getElementById('watchButton');
    if (!button) return;
    
    button.addEventListener('click', async function() {
        const repoId = this.dataset.repoId;
        if (!repoId) return;
        
        const isWatching = this.classList.contains('watching');
        const method = isWatching ? 'DELETE' : 'POST';
        
        try {
            const response = await fetch(`/api/repos/${repoId}/watch`, { method });
            const data = await response.json();
            
            if (data.success) {
                this.classList.toggle('watching');
                const count = document.querySelector('.repo-watchers-count');
                if (count) {
                    const current = parseInt(count.textContent.replace(/[^0-9]/g, '')) || 0;
                    count.textContent = formatNumber(current + (isWatching ? -1 : 1));
                }
                showNotification(isWatching ? '👁️ تم إلغاء المتابعة' : '👁️ تم متابعة المستودع');
            }
        } catch (error) {
            console.error('❌ فشل تحديث المتابعة:', error);
        }
    });
}

// ===== تهيئة زر النسخ =====
function initForkButton() {
    const button = document.getElementById('forkButton');
    if (!button) return;
    
    button.addEventListener('click', async function() {
        const repoId = this.dataset.repoId;
        if (!repoId) return;
        
        try {
            const response = await fetch(`/api/repos/${repoId}/fork`, { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                showNotification('🍴 تم نسخ المستودع بنجاح');
                setTimeout(() => {
                    window.location.href = data.repo.url;
                }, 1000);
            }
        } catch (error) {
            console.error('❌ فشل نسخ المستودع:', error);
        }
    });
}

// ===== تهيئة عرض الكود =====
function initCodeViewer() {
    // التهيئة
}

// ===== أدوات مساعدة =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message) {
    // استخدام نظام الإشعارات الموجود
    if (typeof window.showNotification === 'function') {
        window.showNotification(message);
    } else {
        alert(message);
    }
}

// ===== تصدير الدوال =====
window.toggleFolder = toggleFolder;
window.openFile = openFile;
window.copyCode = copyCode;
window.showCodeViewer = showCodeViewer;