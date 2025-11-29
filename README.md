# 🎓 BroFessor - AI-Powered College Assistant

A production-ready chatbot with **RAG (Retrieval-Augmented Generation)**, semantic search, citations, and secure backend architecture.

## ✨ Features

- 🔐 **Secure Authentication** - Email/password login with role-based access
- 📄 **PDF Document Upload** - Automatic text extraction and embedding generation
- 🧠 **Semantic Search** - Understands meaning, not just keywords (pgvector)
- 🎯 **RAG Architecture** - Retrieval-Augmented Generation for accurate answers
- 📚 **Citations** - Shows source documents for transparency
- 💬 **Markdown Support** - Beautiful formatted responses
- 🔒 **Edge Functions** - Secure API key management on backend
- 🎨 **Modern UI** - Animated gradients, smooth transitions, premium design

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Google Gemini 2.0 Flash + Text Embedding 004
- **Vector Search**: pgvector extension
- **Styling**: Vanilla CSS
- **PDF Processing**: pdfjs-dist

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account ([supabase.com](https://supabase.com))
- Google AI API key ([ai.google.dev](https://ai.google.dev))
- Supabase CLI (for Edge Functions)

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd bot
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings** → **API** and copy:
   - Project URL
   - Anon/Public Key

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database

Run these SQL scripts in **Supabase SQL Editor** (in order):

#### a. Create Tables
```sql
-- Run the contents of schema.sql in your Supabase SQL Editor
```

#### b. Enable Vector Search
```sql
-- Run the contents of vector_setup.sql
-- This enables pgvector and creates the similarity search function
```

### 5. Deploy Edge Functions

```bash
# Login to Supabase
npx supabase login

# Link your project (replace with your project ref from dashboard)
npx supabase link --project-ref your-project-ref

# Set your Gemini API key as a secret
npx supabase secrets set GEMINI_API_KEY=your-gemini-api-key

# Deploy the Edge Function
npx supabase functions deploy chat-handler
```

### 6. Run the Application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 👤 Create Admin User

To create an admin user:

1. Sign up through the app
2. Go to **Supabase Dashboard** → **Authentication** → **Users**
3. Find your user and note the UUID
4. Run this SQL in the SQL Editor:

```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE id = 'your-user-uuid';
```

## 📖 Usage

### For Students/Users:
1. Login with your credentials
2. Ask questions about college documents
3. View citations to see source documents

### For Admins:
1. Login and click **Admin Panel**
2. Upload PDFs - Text is extracted and embedded automatically
3. Manage documents - View or delete uploaded files

## 🏗️ Project Structure

```
bot/
├── src/
│   ├── pages/
│   │   ├── Auth.jsx          # Login/Signup
│   │   ├── Chat.jsx          # Main chat interface
│   │   └── Admin.jsx         # Document management
│   ├── components/
│   │   └── AuthProvider.jsx # Auth context
│   ├── lib/
│   │   ├── supabase.js       # Supabase client
│   │   └── gemini.js         # Edge Function caller
│   └── index.css             # Global styles
├── supabase/
│   └── functions/
│       └── chat-handler/     # Secure Edge Function
│           └── index.ts
├── schema.sql                # Database schema
├── vector_setup.sql          # Vector search setup
└── .env                      # Environment variables
```

## 🐛 Troubleshooting

### "Invalid login credentials"
- Check that you've created an account through the signup page
- Verify email/password are correct

### "Failed to generate response"
- Check that Edge Function is deployed: `npx supabase functions list`
- Verify `GEMINI_API_KEY` is set: `npx supabase secrets list`
- Check Edge Function logs in Supabase Dashboard

### Vector search returns no results
- Ensure documents have embeddings (re-upload PDFs if needed)
- Lower `match_threshold` in Edge Function (try 0.05)
- Check that `pgvector` extension is enabled

### PDF upload fails
- Check file size (max 10MB recommended)
- Ensure PDF contains extractable text (not scanned images)
- Check browser console for errors

## 🔐 Security Notes

- ✅ API keys are stored securely in Edge Functions
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Authentication required for all operations

## 📊 Database Schema

### Tables

**users** (managed by Supabase Auth)

**documents**
- `id`, `title`, `content`, `embedding` (vector), `uploaded_by`, `created_at`

**chat_messages**
- `id`, `user_id`, `message`, `response`, `created_at`

## 📝 License

MIT License

---

**Built with ❤️ for students**
