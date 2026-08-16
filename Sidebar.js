// ============================================================
// ===== SIDEBAR COMPONENT — الشريط الجانبي =====
// ============================================================

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user }) => {
    const location = useLocation();

    const menuItems = [
        { path: '/dashboard', icon: 'fa-home', label: 'لوحة التحكم' },
        { path: '/repos', icon: 'fa-book', label: 'المستودعات' },
        { path: '/issues', icon: 'fa-exclamation-circle', label: 'القضايا' },
        { path: '/pulls', icon: 'fa-code-branch', label: 'طلبات السحب' },
        { path: '/projects', icon: 'fa-project-diagram', label: 'المشاريع' },
        { path: '/settings', icon: 'fa-cog', label: 'الإعدادات' }
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-user">
                <img 
                    src={user?.avatarUrl || 'https://ui-avatars.com/api/?name=User'} 
                    alt={user?.username}
                    className="sidebar-avatar"
                />
                <div className="sidebar-user-info">
                    <h4>{user?.name || user?.username}</h4>
                    <span>@{user?.username}</span>
                </div>
            </div>

            <div className="sidebar-menu">
                {menuItems.map(item => (
                    <Link 
                        key={item.path} 
                        to={item.path}
                        className={`sidebar-menu-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <i className={`fas ${item.icon}`}></i>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;