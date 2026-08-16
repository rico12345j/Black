// ============================================================
// ===== NAVBAR COMPONENT — شريط التنقل =====
// ============================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ user, onLogout }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <nav className="navbar">
            <div className="container">
                <div className="nav-left">
                    <Link to="/" className="nav-logo">
                        <i className="fab fa-github"></i>
                        <span>GitHub</span>
                    </Link>
                    <div className={`nav-links ${isMobileMenuOpen ? 'active' : ''}`}>
                        <Link to="/dashboard" className="nav-link">لوحة التحكم</Link>
                        <Link to="/explore" className="nav-link">استكشاف</Link>
                        <Link to="/trending" className="nav-link">الأكثر شيوعاً</Link>
                    </div>
                </div>

                <div className="nav-right">
                    <form onSubmit={handleSearch} className="search-box">
                        <i className="fas fa-search"></i>
                        <input 
                            type="text" 
                            placeholder="🔍 بحث..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={(e) => e.target.select()}
                        />
                    </form>

                    <div className="nav-actions">
                        {user ? (
                            <>
                                <Link to="/notifications" className="btn btn-outline">
                                    <i className="fas fa-bell"></i>
                                    <span className="badge">0</span>
                                </Link>
                                <Link to={`/${user.username}`} className="btn btn-outline">
                                    <i className="fas fa-user"></i>
                                </Link>
                                <button onClick={onLogout} className="btn btn-outline">
                                    <i className="fas fa-sign-out-alt"></i>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-outline">تسجيل الدخول</Link>
                                <Link to="/signup" className="btn btn-primary">التسجيل</Link>
                            </>
                        )}
                    </div>
                </div>

                <button 
                    className="mobile-menu-btn"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;