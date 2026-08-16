// ============================================================
// ===== COMMENT COMPONENT — مكون التعليق =====
// ============================================================

import React, { useState } from 'react';
import { formatDate, timeAgo } from '../utils/helpers';

const Comment = ({ comment, onReply, onEdit, onDelete, onReact, currentUser }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editBody, setEditBody] = useState(comment.body);
    const [showReplies, setShowReplies] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [showReplyInput, setShowReplyInput] = useState(false);

    const handleEdit = async () => {
        if (editBody.trim() && editBody !== comment.body) {
            await onEdit(comment._id, editBody);
        }
        setIsEditing(false);
    };

    const handleReply = async () => {
        if (replyBody.trim()) {
            await onReply(comment._id, replyBody);
            setReplyBody('');
            setShowReplyInput(false);
        }
    };

    const handleReact = (reaction) => {
        onReact(comment._id, reaction);
    };

    const reactions = [
        { emoji: '👍', key: 'thumbsUp' },
        { emoji: '👎', key: 'thumbsDown' },
        { emoji: '😄', key: 'laugh' },
        { emoji: '🎉', key: 'hooray' },
        { emoji: '😕', key: 'confused' },
        { emoji: '❤️', key: 'heart' },
        { emoji: '🚀', key: 'rocket' },
        { emoji: '👀', key: 'eyes' }
    ];

    const isAuthor = currentUser && comment.author && comment.author._id === currentUser._id;

    return (
        <div className="comment">
            <div className="comment-header">
                <img 
                    src={comment.author?.avatarUrl || 'https://ui-avatars.com/api/?name=User'} 
                    alt={comment.author?.username}
                    className="comment-avatar"
                />
                <div className="comment-meta">
                    <span className="comment-author">{comment.author?.name || comment.author?.username}</span>
                    <span className="comment-username">@{comment.author?.username}</span>
                    <span className="comment-time">{timeAgo(comment.createdAt)}</span>
                    {comment.edited && <span className="comment-edited">(معدل)</span>}
                </div>
                {isAuthor && (
                    <div className="comment-actions">
                        <button onClick={() => setIsEditing(true)} className="action-btn edit-btn">
                            <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => onDelete(comment._id)} className="action-btn delete-btn">
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="comment-edit">
                    <textarea 
                        value={editBody} 
                        onChange={(e) => setEditBody(e.target.value)}
                        className="comment-textarea"
                    />
                    <div className="comment-edit-actions">
                        <button onClick={handleEdit} className="btn btn-primary">حفظ</button>
                        <button onClick={() => setIsEditing(false)} className="btn btn-outline">إلغاء</button>
                    </div>
                </div>
            ) : (
                <div className="comment-body">{comment.body}</div>
            )}

            <div className="comment-footer">
                <div className="comment-reactions">
                    {reactions.map(({ emoji, key }) => {
                        const count = comment.reactions?.[key] || 0;
                        if (count === 0) return null;
                        return (
                            <button 
                                key={key} 
                                onClick={() => handleReact(key)}
                                className="reaction-btn"
                            >
                                {emoji} {count}
                            </button>
                        );
                    })}
                    <button 
                        onClick={() => setShowReplyInput(!showReplyInput)}
                        className="reply-btn"
                    >
                        <i className="fas fa-reply"></i> رد
                    </button>
                </div>
            </div>

            {showReplyInput && (
                <div className="reply-input">
                    <textarea 
                        value={replyBody} 
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="اكتب رداً..."
                        className="comment-textarea"
                    />
                    <div className="reply-actions">
                        <button onClick={handleReply} className="btn btn-primary">إرسال</button>
                        <button onClick={() => setShowReplyInput(false)} className="btn btn-outline">إلغاء</button>
                    </div>
                </div>
            )}

            {comment.replies && comment.replies.length > 0 && (
                <div className="comment-replies">
                    <button 
                        onClick={() => setShowReplies(!showReplies)}
                        className="show-replies-btn"
                    >
                        {showReplies ? 'إخفاء' : 'عرض'} {comment.replies.length} ردود
                    </button>
                    {showReplies && comment.replies.map(reply => (
                        <Comment 
                            key={reply._id} 
                            comment={reply} 
                            onReply={onReply}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onReact={onReact}
                            currentUser={currentUser}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Comment;