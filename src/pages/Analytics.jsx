import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, MessageSquare, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Analytics() {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(7);

    useEffect(() => {
        fetchAnalytics();
    }, [timeRange]);

    async function fetchAnalytics() {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_analytics_summary', {
                days_back: timeRange
            });

            if (error) throw error;
            setAnalytics(data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        width: '48px',
                        height: '48px',
                        border: '4px solid var(--glass-border)',
                        borderTop: '4px solid var(--accent-primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }}></div>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p>
                </div>
            </div>
        );
    }

    const stats = [
        {
            icon: MessageSquare,
            label: 'Total Messages',
            value: analytics?.total_messages || 0,
            color: 'var(--accent-primary)'
        },
        {
            icon: Users,
            label: 'Unique Users',
            value: analytics?.unique_users || 0,
            color: 'var(--accent-secondary)'
        },
        {
            icon: Clock,
            label: 'Avg Response Time',
            value: analytics?.avg_response_time ? `${Math.round(analytics.avg_response_time)}ms` : 'N/A',
            color: 'var(--accent-tertiary)'
        }
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '2rem' }}>
            {/* Header */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', marginBottom: '2rem' }}>
                <Link to="/chat" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    marginBottom: '1rem',
                    transition: 'color 0.2s'
                }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    <ArrowLeft size={20} />
                    Back to Chat
                </Link>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginBottom: '0.5rem'
                        }}>
                            Analytics Dashboard
                        </h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Track usage and performance metrics</p>
                    </div>

                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(Number(e.target.value))}
                        style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '0.75rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {stats.map((stat, idx) => (
                    <div key={idx} style={{
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                        transition: 'transform 0.2s'
                    }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '0.75rem',
                                background: `linear-gradient(135deg, ${stat.color}, ${stat.color}dd)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 4px 12px ${stat.color}40`
                            }}>
                                <stat.icon size={24} color="white" />
                            </div>
                            <div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    {stat.label}
                                </p>
                                <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                    {stat.value}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                gap: '1.5rem'
            }}>
                {/* Messages Over Time */}
                <div style={{
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        <TrendingUp size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                        Messages Over Time
                    </h3>
                    {analytics?.messages_by_day && analytics.messages_by_day.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={analytics.messages_by_day}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" />
                                <YAxis stroke="var(--text-secondary)" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Line type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>
                            No data available
                        </p>
                    )}
                </div>

                {/* Top Questions */}
                <div style={{
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                        <MessageSquare size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                        Top Questions
                    </h3>
                    {analytics?.top_questions && analytics.top_questions.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics.top_questions.slice(0, 5)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                                <XAxis dataKey="question" stroke="var(--text-secondary)" hide />
                                <YAxis stroke="var(--text-secondary)" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Bar dataKey="count" fill="var(--accent-secondary)" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>
                            No data available
                        </p>
                    )}
                    {analytics?.top_questions && analytics.top_questions.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            {analytics.top_questions.slice(0, 5).map((q, idx) => (
                                <div key={idx} style={{
                                    padding: '0.75rem',
                                    marginBottom: '0.5rem',
                                    borderRadius: '0.5rem',
                                    background: 'var(--bg-tertiary)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                        {q.question?.substring(0, 50)}...
                                    </span>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '1rem',
                                        background: 'var(--accent-primary)',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {q.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
