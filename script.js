// ============================================================
// ===== GITHUB CLONE — MAIN SCRIPT =====
// ============================================================

// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🐙 GitHub Clone — جاهز');
    
    initSearch();
    initMobileMenu();
    initScroll();
    initHeroSearch();
    initKeyboardShortcuts();
    loadUserData();
});

// ===== البحث =====
function initSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;
    
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = this.value.trim();
            if (query.length >= 2) {
                performSearch(query);
            }
        }, 300);
    });
}

async function performSearch(query) {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success && data.results) {
            showSearchResults(data.results);
        }
    } catch (error) {
        console.error('❌ فشل البحث:', error);
    }
}

function showSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    
    if (!results || results.length === 0) {
        container.innerHTML = '<div class="search-empty">لا توجد نتائج</div>';
        return;
    }
    
    container.innerHTML = results.map(item => `
        <div class="search-result">
            <a href="${item.url}">${item.title}</a>
            <p>${item.description || ''}</p>
        </div>
    `).join('');
}

// ===== القائمة الجانبية للجوال =====
function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (!menuBtn || !navLinks) return;
    
    menuBtn.addEventListener('click', function() {
        const isVisible = navLinks.style.display === 'flex';
        navLinks.style.display = isVisible ? 'none' : 'flex';
        this.innerHTML = isVisible ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
    });
}

// ===== التمرير السلس =====
function initScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ===== البحث في الهيرو =====
function initHeroSearch() {
    const heroSearch = document.getElementById('heroSearch');
    if (!heroSearch) return;
    
    heroSearch.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        }
    });
}

// ===== اختصارات لوحة المفاتيح =====
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl + / : فتح البحث
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Ctrl + K : البحث السريع
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Escape : إغلاق النوافذ المنبثقة
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ===== إغلاق النوافذ المنبثقة =====
function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ===== تحميل بيانات المستخدم =====
async function loadUserData() {
    try {
        const response = await fetch('/api/auth/verify');
        const data = await response.json();
        
        if (data.success && data.user) {
            updateUI(data.user);
        }
    } catch (error) {
        console.error('❌ فشل تحميل بيانات المستخدم:', error);
    }
}

// ===== تحديث الواجهة =====
function updateUI(user) {
    // تحديث اسم المستخدم
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => {
        el.textContent = user.name || user.username;
    });
    
    // تحديث اسم المستخدم
    const usernameElements = document.querySelectorAll('.user-username');
    usernameElements.forEach(el => {
        el.textContent = `@${user.username}`;
    });
    
    // تحديث الصورة الرمزية
    const avatarElements = document.querySelectorAll('.user-avatar');
    avatarElements.forEach(el => {
        el.src = user.avatarUrl || `https://ui-avatars.com/api/?name=${user.username}`;
    });
    
    // تحديث عدد المتابعين
    document.querySelectorAll('.followers-count').forEach(el => {
        el.textContent = user.followers?.length || 0;
    });
    
    // تحديث عدد المتابعين
    document.querySelectorAll('.following-count').forEach(el => {
        el.textContent = user.following?.length || 0;
    });
}

// ===== تسجيل الخروج =====
async function logoutUser() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('❌ فشل تسجيل الخروج:', error);
    }
}

// ===== تنسيق الأرقام =====
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// ===== وقت نسبي =====
function timeAgo(date) {
    if (!date) return 'الآن';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        سنة: 31536000,
        شهر: 2592000,
        أسبوع: 604800,
        يوم: 86400,
        ساعة: 3600,
        دقيقة: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `منذ ${interval} ${unit}`;
        }
    }
    return 'الآن';
}

// ===== تصدير الدوال =====
window.formatNumber = formatNumber;
window.timeAgo = timeAgo;
window.logoutUser = logoutUser;
window.performSearch = performSearch;
window.loadUserData = loadUserData;