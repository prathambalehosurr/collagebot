import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send, LogOut, Settings, Bot, User, Sparkles, TrendingUp, FileText, Trash2, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { generateResponse } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';

export default function Chat() {
    const { user, signOut, isAdmin } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
    const [currentRatingId, setCurrentRatingId] = useState(null);
    const [feedbackText, setFeedbackText] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Load previous chat messages if needed
        const fetchMessages = async () => {
            const { data, error } = await supabase.from('chat_messages').select('*').eq('user_id', user?.id).order('created_at', { ascending: true });
            if (!error && data) {
                const formatted = [];
                data.forEach(msg => {
                    if (msg.message) {
                        formatted.push({ role: 'user', content: msg.message });
                    }
                    if (msg.response) {
                        formatted.push({
                            id: msg.id,
                            role: 'assistant',
                            content: msg.response,
                            rating: msg.rating
                        });
                    }
                });
                setMessages(formatted);
            }
        };
        if (user) fetchMessages();
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend(e) {
        e.preventDefault();
        if (!input.trim()) return;
        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);
        try {
            const result = await generateResponse([...messages, { role: 'user', content: userMessage }]);

            const { data: insertedData, error: insertError } = await supabase.from('chat_messages').insert({
                user_id: user.id,
                message: userMessage,
                response: result.response
            }).select().single();

            if (insertError) throw insertError;

            setMessages(prev => [...prev, {
                id: insertedData.id,
                role: 'assistant',
                content: result.response,
                citations: result.citations
            }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message || 'Unknown error'}` }]);
        } finally {
            setLoading(false);
        }
    }

    async function clearChat() {
        if (!confirm('Are you sure you want to clear the chat history?')) return;

        try {
            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
            setMessages([]);
        } catch (error) {
            console.error('Error clearing chat:', error);
            alert('Failed to clear chat history');
        }
    }

    async function handleRating(messageId, rating) {
        if (!messageId) return;

        if (rating === 'down') {
            setCurrentRatingId(messageId);
            setFeedbackModalOpen(true);
            return;
        }

        // Optimistic update for 'up' or toggling off
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, rating: rating === msg.rating ? null : rating } : msg
        ));

        try {
            const newRating = messages.find(m => m.id === messageId)?.rating === rating ? null : rating;

            const { error } = await supabase
                .from('chat_messages')
                .update({ rating: newRating, feedback: null }) // Clear feedback if changing to up/null
                .eq('id', messageId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating rating:', error);
            fetchMessages();
        }
    }

    async function submitFeedback() {
        if (!currentRatingId) return;

        // Optimistic update
        setMessages(prev => prev.map(msg =>
            msg.id === currentRatingId ? { ...msg, rating: 'down' } : msg
        ));

        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ rating: 'down', feedback: feedbackText })
                .eq('id', currentRatingId);

            if (error) throw error;

            setFeedbackModalOpen(false);
            setFeedbackText('');
            setCurrentRatingId(null);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback');
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
            {/* Animated Background Orbs */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                right: '-5%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(102, 126, 234, 0.15), transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(60px)',
                animation: 'float 20s ease-in-out infinite',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                left: '-5%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(118, 75, 162, 0.15), transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(60px)',
                animation: 'float 15s ease-in-out infinite reverse',
                pointerEvents: 'none'
            }} />

            {/* Header */}
            <header style={{
                padding: '1.25rem 2rem',
                borderBottom: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(var(--glass-blur))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
                        animation: 'pulse 2s ease-in-out infinite'
                    }}>
                        <Bot size={28} color="white" />
                    </div>
                    <div>
                        <h1 style={{
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            margin: 0,
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>CollegeBot</h1>
                        <p style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}>
                            <Sparkles size={12} /> AI-Powered Assistant
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button onClick={clearChat} className="btn btn-secondary" style={{
                        padding: '0.625rem 1.25rem',
                        gap: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '0.75rem',
                        color: '#ef4444',
                        transition: 'all 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                    }}>
                        <Trash2 size={18} /> Clear Chat
                    </button>
                    {isAdmin && (
                        <>
                            <Link to="/admin" className="btn btn-secondary" style={{
                                padding: '0.625rem 1.25rem',
                                gap: '0.5rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '0.75rem',
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <Settings size={18} /> Admin Panel
                            </Link>
                            <Link to="/analytics" className="btn btn-secondary" style={{
                                padding: '0.625rem 1.25rem',
                                gap: '0.5rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '0.75rem',
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <TrendingUp size={18} /> Analytics
                            </Link>
                        </>
                    )}
                    <button onClick={signOut} className="btn btn-secondary" style={{
                        padding: '0.625rem 1.25rem',
                        gap: '0.5rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '0.75rem',
                        color: 'var(--text-primary)',
                        transition: 'all 0.3s'
                    }}>
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </header>

            {/* Chat Area */}
            <main className="container" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                position: 'relative',
                zIndex: 1
            }}>
                {messages.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        marginTop: 'auto',
                        marginBottom: 'auto',
                        animation: 'fadeIn 0.6s ease-out'
                    }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            margin: '0 auto 2rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                            animation: 'float 3s ease-in-out infinite'
                        }}>
                            <Bot size={64} color="white" />
                        </div>
                        <h2 style={{
                            fontSize: '2rem',
                            marginBottom: '0.5rem',
                            background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>How can I help you today?</h2>
                        <p style={{ fontSize: '1.1rem' }}>Ask me anything about the college documents.</p>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={idx} className="animate-fade-in" style={{
                        display: 'flex',
                        gap: '1rem',
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                        animation: 'slideIn 0.4s ease-out'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))'
                                : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: msg.role === 'assistant' ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                            border: msg.role === 'user' ? '2px solid var(--glass-border)' : 'none'
                        }}>
                            {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                        </div>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderRadius: '1.25rem',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                                : 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            borderTopRightRadius: msg.role === 'user' ? '0.25rem' : '1.25rem',
                            borderTopLeftRadius: msg.role === 'assistant' ? '0.25rem' : '1.25rem',
                            boxShadow: msg.role === 'user'
                                ? '0 4px 16px rgba(102, 126, 234, 0.25)'
                                : '0 4px 16px rgba(0, 0, 0, 0.2)',
                            lineHeight: '1.6',
                            border: msg.role === 'assistant' ? '1px solid var(--glass-border)' : 'none',
                            transition: 'transform 0.2s',
                            cursor: 'default'
                        }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            {msg.role === 'assistant' ? (
                                <>
                                    <ReactMarkdown components={{
                                        p: ({ node, ...props }) => <p style={{ margin: '0 0 1rem 0' }} {...props} />,
                                        ul: ({ node, ...props }) => <ul style={{ margin: '0 0 1rem 1.5rem', listStyleType: 'disc' }} {...props} />,
                                        ol: ({ node, ...props }) => <ol style={{ margin: '0 0 1rem 1.5rem', listStyleType: 'decimal' }} {...props} />,
                                        li: ({ node, ...props }) => <li style={{ marginBottom: '0.5rem' }} {...props} />,
                                        a: ({ node, ...props }) => <a style={{ color: 'var(--accent-tertiary)', textDecoration: 'underline' }} {...props} />,
                                        code: ({ node, ...props }) => <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', fontFamily: 'monospace', fontSize: '0.9em', border: '1px solid rgba(255,255,255,0.1)' }} {...props} />
                                    }}>
                                        {msg.content}
                                    </ReactMarkdown>
                                    {msg.citations && msg.citations.length > 0 && (
                                        <div style={{
                                            marginTop: '1rem',
                                            paddingTop: '1rem',
                                            borderTop: '1px solid var(--glass-border)',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                                                <FileText size={14} />
                                                <span>Sources:</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {msg.citations.map((c, i) => (
                                                    <div key={i} style={{
                                                        padding: '0.25rem 0.75rem',
                                                        background: 'rgba(102, 126, 234, 0.1)',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid rgba(102, 126, 234, 0.3)',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        Document {c.id} ({Math.round(c.similarity * 100)}% match)
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Rating Buttons */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        marginTop: '0.75rem',
                                        justifyContent: 'flex-end'
                                    }}>
                                        <button
                                            onClick={() => handleRating(msg.id, 'up')}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '0.25rem',
                                                color: msg.rating === 'up' ? '#10b981' : 'var(--text-secondary)',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}
                                            title="Helpful"
                                        >
                                            <ThumbsUp size={16} fill={msg.rating === 'up' ? 'currentColor' : 'none'} />
                                        </button>
                                        <button
                                            onClick={() => handleRating(msg.id, 'down')}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '0.25rem',
                                                color: msg.rating === 'down' ? '#ef4444' : 'var(--text-secondary)',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}
                                            title="Not helpful"
                                        >
                                            <ThumbsDown size={16} fill={msg.rating === 'down' ? 'currentColor' : 'none'} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                msg.content
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ display: 'flex', gap: '1rem', maxWidth: '75%', animation: 'slideIn 0.4s ease-out' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                            animation: 'pulse 2s ease-in-out infinite'
                        }}>
                            <Bot size={20} />
                        </div>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderRadius: '1.25rem',
                            background: 'var(--bg-secondary)',
                            borderTopLeftRadius: '0.25rem',
                            display: 'flex',
                            gap: '0.625rem',
                            alignItems: 'center',
                            border: '1px solid var(--glass-border)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}>
                            <span style={{
                                width: '10px',
                                height: '10px',
                                background: 'var(--accent-primary)',
                                borderRadius: '50%',
                                animation: 'bounce 1.4s infinite ease-in-out',
                                boxShadow: '0 0 10px var(--accent-primary)'
                            }} />
                            <span style={{
                                width: '10px',
                                height: '10px',
                                background: 'var(--accent-primary)',
                                borderRadius: '50%',
                                animation: 'bounce 1.4s infinite ease-in-out 0.2s',
                                boxShadow: '0 0 10px var(--accent-primary)'
                            }} />
                            <span style={{
                                width: '10px',
                                height: '10px',
                                background: 'var(--accent-primary)',
                                borderRadius: '50%',
                                animation: 'bounce 1.4s infinite ease-in-out 0.4s',
                                boxShadow: '0 0 10px var(--accent-primary)'
                            }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <div style={{
                padding: '1.5rem 2rem 2rem',
                background: 'linear-gradient(to top, var(--bg-primary), transparent)',
                borderTop: '1px solid var(--glass-border)',
                position: 'relative',
                zIndex: 2
            }}>
                <form onSubmit={handleSend} className="container" style={{
                    position: 'relative',
                    maxWidth: '900px',
                    margin: '0 auto'
                }}>
                    <input
                        type="text"
                        className="input"
                        placeholder="Type your question..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        style={{
                            paddingRight: '4rem',
                            paddingLeft: '1.75rem',
                            height: '4rem',
                            borderRadius: '2rem',
                            background: 'var(--bg-secondary)',
                            border: '2px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            transition: 'all 0.3s',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}
                        onFocus={e => {
                            e.target.style.borderColor = 'var(--accent-primary)';
                            e.target.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.3)';
                        }}
                        onBlur={e => {
                            e.target.style.borderColor = 'var(--glass-border)';
                            e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
                        }}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: loading || !input.trim() ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            border: 'none',
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '50%',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s',
                            boxShadow: loading || !input.trim() ? 'none' : '0 4px 16px rgba(102, 126, 234, 0.4)',
                            opacity: loading || !input.trim() ? 0.5 : 1
                        }}
                        onMouseEnter={e => {
                            if (!loading && input.trim()) {
                                e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                            e.currentTarget.style.boxShadow = loading || !input.trim() ? 'none' : '0 4px 16px rgba(102, 126, 234, 0.4)';
                        }}
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>

            <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(5deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.9; } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        .container { width: 100%; max-width: 1200px; margin: 0 auto; }
        main::-webkit-scrollbar { width: 8px; }
        main::-webkit-scrollbar-track { background: var(--bg-primary); }
        main::-webkit-scrollbar-thumb { background: var(--accent-primary); border-radius: 4px; }
        main::-webkit-scrollbar-thumb:hover { background: var(--accent-secondary); }
      `}</style>

            {/* Feedback Modal */}
            {feedbackModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '1rem',
                        padding: '2rem',
                        width: '90%',
                        maxWidth: '500px',
                        position: 'relative',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                    }}>
                        <button
                            onClick={() => setFeedbackModalOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                            What went wrong?
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Your feedback helps us improve the bot's accuracy.
                        </p>

                        <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="e.g., The answer was inaccurate, outdated, or irrelevant..."
                            style={{
                                width: '100%',
                                height: '120px',
                                padding: '1rem',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '0.5rem',
                                color: 'var(--text-primary)',
                                marginBottom: '1.5rem',
                                resize: 'none'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => setFeedbackModalOpen(false)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'transparent',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '0.5rem',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitFeedback}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Submit Feedback
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
