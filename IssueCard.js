// ============================================================
// ===== ISSUE CARD COMPONENT — بطاقة القضية =====
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../utils/helpers';

const IssueCard = ({ issue }) => {
    const isOpen = issue.state === 'open';

    return (
        <div className="issue-card">
            <div className="issue-card-header">
                <span className={`issue-state ${isOpen ? 'open' : 'closed'}`}>
                    <i className={`fas ${isOpen ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
                    {isOpen ? 'مفتوحة' : 'مغلقة'}
                </span>
                <Link 
                    to={`/${issue.repository?.owner?.username}/${issue.repository?.name}/issues/${issue.number}`} 
                    className="issue-title"
                >
                    {issue.title}
                </Link>
                <span className="issue-number">#{issue.number}</span>
            </div>

            <div className="issue-card-body">
                {issue.labels && issue.labels.length > 0 && (
                    <div className="issue-labels">
                        {issue.labels.map(label => (
                            <span 
                                key={label.name} 
                                className="issue-label"
                                style={{ backgroundColor: `#${label.color}` }}
                            >
                                {label.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="issue-card-footer">
                <img 
                    src={issue.author?.avatarUrl || 'https://ui-avatars.com/api/?name=User'} 
                    alt={issue.author?.username}
                    className="issue-avatar"
                />
                <span className="issue-author">
                    {issue.author?.name || issue.author?.username}
                </span>
                <span className="issue-time">
                    {timeAgo(issue.createdAt)}
                </span>
                {issue.commentsCount > 0 && (
                    <span className="issue-comments">
                        <i className="fas fa-comment"></i>
                        {issue.commentsCount}
                    </span>
                )}
                {issue.assignees && issue.assignees.length > 0 && (
                    <div className="issue-assignees">
                        {issue.assignees.map(assignee => (
                            <img 
                                key={assignee._id} 
                                src={assignee.avatarUrl || 'https://ui-avatars.com/api/?name=User'} 
                                alt={assignee.username}
                                className="assignee-avatar"
                                title={assignee.name || assignee.username}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IssueCard;