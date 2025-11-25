import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, FileText, File, Sparkles } from 'lucide-react';
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

    useEffect(() => {
        fetchDocuments();
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

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
            setMessage({ type: 'error', text: 'Only PDF and TXT files are supported.' });
            return;
        }

        setUploading(true);
        setMessage({ type: 'info', text: 'Processing file... This may take a moment.' });

        try {
            let content = '';

            if (file.type === 'application/pdf') {
                content = await extractTextFromPdf(file);
            } else {
                content = await file.text();
            }

            if (!content.trim()) {
                throw new Error('Could not extract text from file.');
            }

            // Generate embedding
            const embedding = await embedText(content);

            const { error } = await supabase.from('documents').insert({
                title: file.name,
                content: content,
                file_type: file.type === 'application/pdf' ? 'pdf' : 'txt',
                uploaded_by: user.id,
                embedding: embedding
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Document uploaded successfully!' });
            fetchDocuments();
        } catch (error) {
            console.error('Upload error:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to upload document.' });
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
            setMessage({ type: 'success', text: 'Document deleted successfully.' });
        } catch (error) {
            console.error('Delete error:', error);
            setMessage({ type: 'error', text: 'Failed to delete document.' });
        }
    }

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem' }}>
                    <ArrowLeft size={18} /> Back to Chat
                </Link>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Admin Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Manage knowledge base documents</p>
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

            <div className="card">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} /> Uploaded Documents
                </h2>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading documents...</p>
                ) : documents.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No documents uploaded yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {documents.map(doc => (
                            <div key={doc.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        padding: '0.5rem',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        borderRadius: '0.5rem',
                                        color: 'var(--accent-primary)'
                                    }}>
                                        <File size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{doc.title}</h3>
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
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        padding: '0.5rem',
                                        borderRadius: '0.5rem',
                                        transition: 'background 0.2s'
                                    }}
                                    className="hover:bg-red-500/10"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
