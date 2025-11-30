import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, FileText, File, Sparkles, Search, Edit2, Check, X, ThumbsDown, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { extractTextFromPdf } from '../lib/pdf';
import { useAuth } from '../components/AuthProvider';
import { embedText } from '../lib/gemini';

export default function Admin() {
    const { user } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocs, setSelectedDocs] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [lowRatedMessages, setLowRatedMessages] = useState([]);

    useEffect(() => {
        fetchDocuments();
        fetchLowRatedMessages();
    }, []);

    async function fetchDocuments() {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('uploaded_at', { ascending: false });

            if (error) throw error;
            setDocuments(data);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchLowRatedMessages() {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('rating', 'down')
                .not('feedback', 'is', null) // Only show ones with feedback for now? Or all down rated? Let's show all down rated.
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLowRatedMessages(data);
        } catch (error) {
            console.error('Error fetching low rated messages:', error);
        }
    }

    async function dismissFeedback(id) {
        try {
            // Clear the feedback text but keep the rating? Or clear rating?
            // Let's clear the feedback text so it disappears from this list (if we filter by feedback)
            // But if we want to keep the rating for analytics, we should just mark it handled.
            // Since we don't have a 'handled' column, let's just clear the feedback text for now as a way to "archive" the feedback.
            const { error } = await supabase
                .from('chat_messages')
                .update({ feedback: null })
                .eq('id', id);

            if (error) throw error;
            setLowRatedMessages(prev => prev.filter(msg => msg.id !== id));
            setMessage({ type: 'success', text: 'Feedback dismissed.' });
        } catch (error) {
            console.error('Error dismissing feedback:', error);
            setMessage({ type: 'error', text: 'Failed to dismiss feedback.' });
        }
    }


    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // File size validation (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            setMessage({
                type: 'error',
                text: `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
            });
            e.target.value = null;
            return;
        }

        // File type validation
        if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
            setMessage({
                type: 'error',
                text: 'Only PDF and TXT files are supported. Please upload a valid file.'
            });
            e.target.value = null;
            return;
        }

        setUploading(true);
        setMessage({ type: 'info', text: 'Step 1/3: Reading file...' });

        try {
            let content = '';

            // Extract text from file
            if (file.type === 'application/pdf') {
                setMessage({ type: 'info', text: 'Step 1/3: Extracting text from PDF...' });
                content = await extractTextFromPdf(file);
            } else {
                content = await file.text();
            }

            if (!content.trim()) {
                throw new Error('The file appears to be empty or contains no readable text.');
            }

            // Generate embedding
            setMessage({ type: 'info', text: 'Step 2/3: Generating embeddings...' });
            const embedding = await embedText(content);

            // Upload to database
            setMessage({ type: 'info', text: 'Step 3/3: Saving to database...' });
            const { error } = await supabase.from('documents').insert({
                title: file.name,
                content: content,
                file_type: file.type === 'application/pdf' ? 'pdf' : 'txt',
                uploaded_by: user.id,
                embedding: embedding
            });

            if (error) {
                if (error.code === '23505') {
                    throw new Error('A document with this name already exists.');
                }
                throw new Error(`Database error: ${error.message}`);
            }

            setMessage({ type: 'success', text: '✅ Document uploaded and vectorized successfully!' });
            fetchDocuments();
        } catch (error) {
            console.error('Upload error:', error);

            // Categorize errors for better user feedback
            let errorMessage = 'Failed to upload document.';

            if (error.message.includes('fetch') || error.message.includes('network')) {
                errorMessage = '❌ Network error. Please check your internet connection and try again.';
            } else if (error.message.includes('Embedding')) {
                errorMessage = `❌ Embedding generation failed: ${error.message}`;
            } else if (error.message.includes('PDF')) {
                errorMessage = '❌ Failed to read PDF. The file may be corrupted or password-protected.';
            } else if (error.message) {
                errorMessage = `❌ ${error.message}`;
            }

            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setUploading(false);
            e.target.value = null; // Reset input
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;

        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setDocuments(prev => prev.filter(doc => doc.id !== id));
            setSelectedDocs(prev => prev.filter(docId => docId !== id));
            setMessage({ type: 'success', text: 'Document deleted successfully.' });
        } catch (error) {
            console.error('Delete error:', error);
            setMessage({ type: 'error', text: 'Failed to delete document.' });
        }
    }

    function toggleSelectDoc(id) {
        setSelectedDocs(prev =>
            prev.includes(id) ? prev.filter(docId => docId !== id) : [...prev, id]
        );
    }

    async function handleBulkDelete() {
        if (selectedDocs.length === 0) return;
        if (!confirm(`Delete ${selectedDocs.length} document(s)? This action cannot be undone.`)) return;

        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .in('id', selectedDocs);

            if (error) throw error;

            setDocuments(prev => prev.filter(doc => !selectedDocs.includes(doc.id)));
            setSelectedDocs([]);
            setMessage({ type: 'success', text: `${selectedDocs.length} document(s) deleted successfully.` });
        } catch (error) {
            console.error('Bulk delete error:', error);
            setMessage({ type: 'error', text: 'Failed to delete documents.' });
        }
    }

    function startEdit(doc) {
        setEditingId(doc.id);
        setEditTitle(doc.title);
    }

    async function saveEdit(id) {
        if (!editTitle.trim()) {
            setMessage({ type: 'error', text: 'Title cannot be empty.' });
            return;
        }

        try {
            const { error } = await supabase
                .from('documents')
                .update({ title: editTitle.trim() })
                .eq('id', id);

            if (error) throw error;

            setDocuments(prev => prev.map(doc =>
                doc.id === id ? { ...doc, title: editTitle.trim() } : doc
            ));
            setEditingId(null);
            setMessage({ type: 'success', text: 'Title updated successfully.' });
        } catch (error) {
            console.error('Edit error:', error);
            setMessage({ type: 'error', text: 'Failed to update title.' });
        }
    }

    function getDocStats(doc) {
        const wordCount = doc.content.trim().split(/\s+/).length;
        const charCount = doc.content.length;
        return { wordCount, charCount };
    }

    // Filter documents based on search query
    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem' }}>
                    <ArrowLeft size={18} /> Back to Chat
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <img
                        src="/brofessor-logo.jpg"
                        alt="BroFessor Logo"
                        style={{
                            width: '80px',
                            height: '80px',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 12px rgba(255, 215, 0, 0.3))'
                        }}
                    />
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Admin Dashboard</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Manage knowledge base documents</p>
                    </div>
                </div>
            </div>

            {message.text && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '2rem',
                    background: message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: message.type === 'error' ? '#fca5a5' : message.type === 'success' ? '#86efac' : '#93c5fd',
                    border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.5)' : message.type === 'success' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(59, 130, 246, 0.5)'}`
                }}>
                    {message.text}
                </div>
            )}

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Upload size={20} /> Upload New Document
                </h2>

                <div style={{
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '1rem',
                    padding: '3rem',
                    textAlign: 'center',
                    cursor: uploading ? 'wait' : 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s'
                }}
                    onClick={() => !uploading && document.getElementById('file-upload').click()}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <input
                        type="file"
                        id="file-upload"
                        style={{ display: 'none' }}
                        accept=".pdf,.txt"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                    }}>
                        <Upload size={32} color="var(--accent-primary)" />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        {uploading ? 'Processing...' : 'Click to upload or drag and drop'}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        PDF or TXT files only
                    </p>
                </div>
            </div>



            {/* Low Rated Messages Review */}
            {
                lowRatedMessages.length > 0 && (
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                            <ThumbsDown size={20} /> Review Low Rated Messages
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {lowRatedMessages.map(msg => (
                                <div key={msg.id} style={{
                                    padding: '1rem',
                                    background: 'rgba(239, 68, 68, 0.05)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: '0.5rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {new Date(msg.created_at).toLocaleString()}
                                        </span>
                                        <button
                                            onClick={() => dismissFeedback(msg.id)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}
                                            className="hover:text-primary"
                                        >
                                            <Check size={14} /> Dismiss
                                        </button>
                                    </div>

                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>User:</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{msg.message}</div>
                                    </div>

                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Bot:</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxHeight: '100px', overflowY: 'auto' }}>{msg.response}</div>
                                    </div>

                                    {msg.feedback && (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '0.75rem',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '0.5rem',
                                            borderLeft: '3px solid #ef4444'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                <MessageCircle size={14} /> Feedback
                                            </div>
                                            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{msg.feedback}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            <div className="card">
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <FileText size={20} /> Uploaded Documents
                        </h2>
                        {selectedDocs.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '0.5rem',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                                className="hover:bg-red-500/20"
                            >
                                <Trash2 size={16} /> Delete {selectedDocs.length} selected
                            </button>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{
                            position: 'absolute',
                            left: '1rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)'
                        }} />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem 0.75rem 3rem',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '0.5rem',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                    </div>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading documents...</p>
                ) : filteredDocuments.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                        {searchQuery ? 'No documents match your search.' : 'No documents uploaded yet.'}
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {filteredDocuments.map(doc => {
                            const stats = getDocStats(doc);
                            const isEditing = editingId === doc.id;
                            const isSelected = selectedDocs.includes(doc.id);

                            return (
                                <div key={doc.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '1rem',
                                    background: isSelected ? 'rgba(102, 126, 234, 0.1)' : 'var(--bg-secondary)',
                                    borderRadius: '0.5rem',
                                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                    transition: 'all 0.2s'
                                }}>
                                    {/* Checkbox */}
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectDoc(doc.id)}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer',
                                            accentColor: 'var(--accent-primary)'
                                        }}
                                    />

                                    {/* File Icon */}
                                    <div style={{
                                        padding: '0.5rem',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        borderRadius: '0.5rem',
                                        color: 'var(--accent-primary)',
                                        flexShrink: 0
                                    }}>
                                        <File size={20} />
                                    </div>

                                    {/* Document Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.25rem 0.5rem',
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--accent-primary)',
                                                            borderRadius: '0.25rem',
                                                            color: 'var(--text-primary)',
                                                            fontSize: '1rem'
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => saveEdit(doc.id)}
                                                        style={{
                                                            padding: '0.25rem',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#10b981',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        style={{
                                                            padding: '0.25rem',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#ef4444',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                                        {doc.title}
                                                    </h3>
                                                    <button
                                                        onClick={() => startEdit(doc)}
                                                        style={{
                                                            padding: '0.25rem',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: 'var(--text-secondary)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}
                                                        title="Edit title"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </>
                                            )}

                                            {/* File Type Badge */}
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.1rem 0.4rem',
                                                borderRadius: '0.25rem',
                                                background: 'var(--bg-tertiary)',
                                                color: 'var(--text-secondary)',
                                                border: '1px solid var(--glass-border)'
                                            }}>
                                                {doc.file_type.toUpperCase()}
                                            </span>

                                            {/* Vectorized Badge */}
                                            {doc.embedding && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.1rem 0.4rem',
                                                    borderRadius: '0.25rem',
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}>
                                                    <Sparkles size={10} /> Vectorized
                                                </span>
                                            )}
                                        </div>

                                        {/* Document Statistics */}
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                            <span>📊 {stats.wordCount.toLocaleString()} words</span>
                                            <span>📝 {stats.charCount.toLocaleString()} chars</span>
                                            <span>📅 {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            transition: 'background 0.2s',
                                            flexShrink: 0
                                        }}
                                        className="hover:bg-red-500/10"
                                        title="Delete document"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div >
    );
}
