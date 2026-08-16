// ============================================================
// ===== PULL CARD COMPONENT — بطاقة طلب السحب =====
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../utils/helpers';

const PullCard = ({ pull }) => {
    const getStateIcon = () => {
        switch (pull.state) {
            case 'merged':
                return <i className="fas fa-check-circle merged"></i>;
            case 'closed':
                return <i className="fas fa-times-circle closed"></i>;
            default:
                return <i className="fas fa-code-branch open"></i>;
        }
    };

    const getStateText = () => {
        switch (pull.state) {
            case 'merged':
                return 'مدمج';
            case 'closed':
                return 'مغلق';
            default:
                return 'مفتوح';
        }
    };

    return (
        <div className="pull-card">
            <div className="pull-card-header">
                <span className={`pull-state ${pull.state}`}>
                    {getStateIcon()}
                    {getStateText()}
                </span>
                <Link 
                    to={`/${pull.repository?.owner?.username}/${pull.repository?.name}/pulls/${pull.number}`} 
                    className="pull-title"
                >
                    {pull.title}
                </Link>
                <span className="pull-number">#{pull.number}</span>
            </div>

            <div className="pull-card-body">
                <span className="pull-branches">
                    <span className="branch">{pull.headBranch}</span>
                    <i className="fas fa-arrow-left"></i>
                    <span className="branch">{pull.baseBranch}</span>
                </span>
                {pull.draft && <span className="pull-draft">مسودة</span>}
            </div>

            <div className="pull-card-footer">
                <img 
                    src={pull.author?.avatarUrl || 'https://ui-avatars.com/api/?name=User'} 
                    alt={pull.author?.username}
                    className="pull-avatar"
                />
                <span className="pull-author">
                    {pull.author?.name || pull.author?.username}
                </span>
                <span className="pull-time">
                    {timeAgo(pull.createdAt)}
                </span>
                {pull.commentsCount > 0 && (
                    <span className="pull-comments">
                        <i className="fas fa-comment"></i>
                        {pull.commentsCount}
                    </span>
                )}
                {pull.reviewers && pull.reviewers.length > 0 && (
                    <div className="pull-reviewers">
                        {pull.reviewers.map(reviewer => (
                            <img 
                                key={reviewer._id} 
                                src={reviewer.avatarUrl || 'https://ui-avatars.com/api/?name=User'} 
                                alt={reviewer.username}
                                className="reviewer-avatar"
                                title={reviewer.name || reviewer.username}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PullCard;