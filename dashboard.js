// ============================================================
// ===== DASHBOARD SCRIPT — لوحة التحكم =====
// ============================================================

// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Dashboard — جاهز');
    
    loadDashboardData();
    initActivityChart();
    initContributions();
});

// ===== تحميل بيانات لوحة التحكم =====
async function loadDashboardData() {
    try {
        // تحميل بيانات المستخدم
        const userResponse = await fetch('/api/users/me');
        const userData = await userResponse.json();
        
        if (userData.success) {
            updateUserStats(userData.user);
        }
        
        // تحميل المستودعات
        const reposResponse = await fetch('/api/repos');
        const reposData = await reposResponse.json();
        
        if (reposData.success) {
            displayRepos(reposData.repos);
        }
        
        // تحميل القضايا الأخيرة
        const issuesResponse = await fetch('/api/issues?limit=10');
        const issuesData = await issuesResponse.json();
        
        if (issuesData.success) {
            displayRecentIssues(issuesData.issues);
        }
        
        // تحميل طلبات السحب الأخيرة
        const pullsResponse = await fetch('/api/pulls?limit=10');
        const pullsData = await pullsResponse.json();
        
        if (pullsData.success) {
            displayRecentPulls(pullsData.pulls);
        }
        
    } catch (error) {
        console.error('❌ فشل تحميل بيانات لوحة التحكم:', error);
    }
}

// ===== تحديث إحصائيات المستخدم =====
function updateUserStats(user) {
    document.querySelector('.stat-repos .stat-number').textContent = user.reposCount || 0;
    document.querySelector('.stat-followers .stat-number').textContent = user.followers?.length || 0;
    document.querySelector('.stat-stars .stat-number').textContent = user.starsCount || 0;
    document.querySelector('.stat-issues .stat-number').textContent = user.issuesCount || 0;
}

// ===== عرض المستودعات =====
function displayRepos(repos) {
    const container = document.getElementById('reposList');
    if (!container) return;
    
    if (!repos || repos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد مستودعات</p>
                <a href="/new" class="btn btn-primary">إنشاء مستودع</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = repos.slice(0, 5).map(repo => `
        <div class="repo-card">
            <div class="repo-card-header">
                <a href="/${repo.owner?.username}/${repo.name}" class="repo-name">
                    <i class="fas fa-book"></i>
                    ${repo.name}
                </a>
                <span class="repo-visibility ${repo.isPublic ? 'public' : 'private'}">
                    ${repo.isPublic ? 'عام' : 'خاص'}
                </span>
            </div>
            ${repo.description ? `<p class="repo-description">${repo.description}</p>` : ''}
            <div class="repo-card-footer">
                ${repo.language ? `<span class="repo-language"><span class="language-dot"></span>${repo.language}</span>` : ''}
                ${repo.stars > 0 ? `<span class="repo-stars"><i class="fas fa-star"></i> ${formatNumber(repo.stars)}</span>` : ''}
                ${repo.forks > 0 ? `<span class="repo-forks"><i class="fas fa-code-branch"></i> ${formatNumber(repo.forks)}</span>` : ''}
                <span class="repo-updated">${timeAgo(repo.updatedAt)}</span>
            </div>
        </div>
    `).join('');
}

// ===== عرض القضايا الأخيرة =====
function displayRecentIssues(issues) {
    const container = document.getElementById('recentIssues');
    if (!container) return;
    
    if (!issues || issues.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد قضايا</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = issues.map(issue => `
        <div class="issue-card">
            <div class="issue-card-header">
                <span class="issue-state ${issue.state}">
                    <i class="fas ${issue.state === 'open' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
                    ${issue.state === 'open' ? 'مفتوحة' : 'مغلقة'}
                </span>
                <a href="/${issue.repository?.owner?.username}/${issue.repository?.name}/issues/${issue.number}" class="issue-title">
                    ${issue.title}
                </a>
                <span class="issue-number">#${issue.number}</span>
            </div>
            <div class="issue-card-footer">
                <img src="${issue.author?.avatarUrl || 'https://ui-avatars.com/api/?name=User'}" 
                     alt="${issue.author?.username}" 
                     class="issue-avatar">
                <span>${issue.author?.name || issue.author?.username}</span>
                <span>${timeAgo(issue.createdAt)}</span>
                ${issue.commentsCount > 0 ? `<span><i class="fas fa-comment"></i> ${issue.commentsCount}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ===== عرض طلبات السحب الأخيرة =====
function displayRecentPulls(pulls) {
    const container = document.getElementById('recentPulls');
    if (!container) return;
    
    if (!pulls || pulls.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد طلبات سحب</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pulls.map(pull => `
        <div class="pull-card">
            <div class="pull-card-header">
                <span class="pull-state ${pull.state}">
                    <i class="fas ${pull.state === 'open' ? 'fa-code-branch' : pull.state === 'merged' ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    ${pull.state === 'open' ? 'مفتوح' : pull.state === 'merged' ? 'مدمج' : 'مغلق'}
                </span>
                <a href="/${pull.repository?.owner?.username}/${pull.repository?.name}/pulls/${pull.number}" class="pull-title">
                    ${pull.title}
                </a>
                <span class="pull-number">#${pull.number}</span>
            </div>
            <div class="pull-card-body">
                <span class="pull-branches">
                    <span class="branch">${pull.headBranch}</span>
                    <i class="fas fa-arrow-left"></i>
                    <span class="branch">${pull.baseBranch}</span>
                </span>
                ${pull.draft ? '<span class="pull-draft">مسودة</span>' : ''}
            </div>
            <div class="pull-card-footer">
                <img src="${pull.author?.avatarUrl || 'https://ui-avatars.com/api/?name=User'}" 
                     alt="${pull.author?.username}" 
                     class="pull-avatar">
                <span>${pull.author?.name || pull.author?.username}</span>
                <span>${timeAgo(pull.createdAt)}</span>
                ${pull.commentsCount > 0 ? `<span><i class="fas fa-comment"></i> ${pull.commentsCount}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ===== تهيئة مخطط النشاط =====
function initActivityChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;
    
    // يمكن استخدام Chart.js أو رسم بسيط
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // رسم مخطط بسيط
    ctx.fillStyle = '#21262d';
    ctx.fillRect(0, 0, width, height);
    
    // بيانات وهمية
    const data = [30, 45, 60, 35, 70, 85, 55, 90, 75, 50, 65, 80];
    const barWidth = width / data.length - 10;
    const maxValue = Math.max(...data);
    
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * (height - 40);
        const x = index * (barWidth + 10) + 5;
        const y = height - barHeight - 20;
        
        // رسم العمود
        const gradient = ctx.createLinearGradient(0, y, 0, height - 20);
        gradient.addColorStop(0, '#58a6ff');
        gradient.addColorStop(1, '#1f6feb');
        
        ctx.fillStyle = gradient;
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
    });
}

// ===== تهيئة مساهمات المستخدم =====
function initContributions() {
    const container = document.getElementById('contributions');
    if (!container) return;
    
    // توليد شبكة مساهمات وهمية
    const weeks = 20;
    const days = 7;
    
    container.innerHTML = '<div class="contributions-grid">';
    
    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < days; d++) {
            const level = Math.floor(Math.random() * 5);
            const color = ['#0d1117', '#0e4429', '#006d32', '#26a641', '#39d353'][level];
            
            const cell = document.createElement('div');
            cell.className = 'contribution-cell';
            cell.style.backgroundColor = color;
            cell.title = `${level} مساهمة`;
            container.appendChild(cell);
        }
    }
    
    container.innerHTML += '</div>';
}

// ===== تصدير الدوال =====
window.loadDashboardData = loadDashboardData;
window.displayRepos = displayRepos;
window.displayRecentIssues = displayRecentIssues;
window.displayRecentPulls = displayRecentPulls;