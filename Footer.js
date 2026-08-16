// ============================================================
// ===== FOOTER COMPONENT — التذييل =====
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-bottom">
                    <span>© 2024 GitHub Clone. جميع الحقوق محفوظة.</span>
                    <div className="footer-links">
                        <Link to="/terms">الشروط</Link>
                        <Link to="/privacy">الخصوصية</Link>
                        <Link to="/security">الأمان</Link>
                        <Link to="/status">الحالة</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;