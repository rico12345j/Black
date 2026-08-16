// ============================================================
// ===== REPO CARD COMPONENT — بطاقة المستودع =====
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { formatNumber, timeAgo } from '../utils/helpers';

const RepoCard = ({ repo }) => {
    const languageColors = {
        JavaScript: '#f1e05a',
        TypeScript: '#3178c6',
        Python: '#3572A5',
        Java: '#b07219',
        Go: '#00ADD8',
        Rust: '#dea584',
        'C++': '#f34b7d',
        Ruby: '#701516',
        PHP: '#4F5D95',
        Swift: '#ffac45'
    };

    return (
        <div className="repo-card">
            <div className="repo-card-header">
                <Link to={`/${repo.owner?.username}/${repo.name}`} className="repo-name">
                    <i className="fas fa-book"></i>
                    {repo.name}
                </Link>
                <span className={`repo-visibility ${repo.isPublic ? 'public' : 'private'}`}>
                    {repo.isPublic ? 'عام' : 'خاص'}
                </span>
            </div>

            {repo.description && (
                <p className="repo-description">{repo.description}</p>
            )}

            <div className="repo-card-footer">
                {repo.language && (
                    <span className="repo-language">
                        <span 
                            className="language-dot" 
                            style={{ backgroundColor: languageColors[repo.language] || '#ccc' }}
                        ></span>
                        {repo.language}
                    </span>
                )}

                {repo.stars > 0 && (
                    <span className="repo-stars">
                        <i className="fas fa-star"></i>
                        {formatNumber(repo.stars)}
                    </span>
                )}

                {repo.forks > 0 && (
                    <span className="repo-forks">
                        <i className="fas fa-code-branch"></i>
                        {formatNumber(repo.forks)}
                    </span>
                )}

                <span className="repo-updated">
                    {timeAgo(repo.updatedAt)}
                </span>
            </div>
        </div>
    );
};

export default RepoCard;