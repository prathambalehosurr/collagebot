-- 1. Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- 2. Add a column to the 'documents' table to store the vector embeddings
-- Gemini's text-embedding-004 model produces vectors with 768 dimensions
alter table documents add column if not exists embedding vector(768);

-- 3. Create a function to search for documents based on vector similarity
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
