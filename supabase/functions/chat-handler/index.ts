import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to generate embeddings using OpenRouter API
async function generateEmbedding(text: string, openRouterApiKey: string): Promise<number[]> {
  try {
    // Using OpenRouter's embeddings API with sentence-transformers model
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`
      },
      body: JSON.stringify({
        model: 'BAAI/bge-base-en-v1.5',
        input: text.substring(0, 8000) // Limit text length
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Embedding API error:', response.status, errorText)
      throw new Error(`Failed to generate embedding: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    // OpenRouter returns embeddings in OpenAI-compatible format
    return data.data[0].embedding
  } catch (error: any) {
    console.error('Error generating embedding:', error)
    throw error
  }
}

// Helper function to search documents using vector similarity
async function searchDocuments(
  supabaseClient: any,
  queryEmbedding: number[],
  matchThreshold: number = 0.5,
  matchCount: number = 3
) {
  try {
    const { data, error } = await supabaseClient.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    })

    if (error) {
      console.error('Vector search error:', error)
      return []
    }

    return data || []
  } catch (error: any) {
    console.error('Error searching documents:', error)
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request body
    const body = await req.json()
    
    // Validate API keys
    const bytezApiKey = Deno.env.get('BYTEZ_API_KEY')
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    
    if (!bytezApiKey) {
      console.error('BYTEZ_API_KEY environment variable is not set')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Bytez API key not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!openRouterApiKey) {
      console.error('OPENROUTER_API_KEY environment variable is not set')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: OpenRouter API key not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle embedding generation request
    if (body.action === 'embed') {
        const { text } = body
        if (!text || typeof text !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Invalid request: text is required for embedding' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        
        try {
            console.log('Attempting to generate embedding. API Key present:', !!bytezApiKey);
            const embedding = await generateEmbedding(text, openRouterApiKey)
            return new Response(
                JSON.stringify({ embedding }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } catch (error: any) {
            console.error('Embedding generation failed:', error);
            return new Response(
                JSON.stringify({ error: `Embedding generation failed: ${error.message}` }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
    }

    // Default: Handle chat request
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userMessage = messages[messages.length - 1]?.content
    if (!userMessage || typeof userMessage !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: last message must have content' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing message for user ${user.id}: "${userMessage.substring(0, 50)}..."`)

    // RAG: Search for relevant documents
    let contextText = ''
    let citations: any[] = []
    
    try {
      const queryEmbedding = await generateEmbedding(userMessage, openRouterApiKey)
      const relevantDocs = await searchDocuments(supabaseClient, queryEmbedding, 0.5, 3)
      
      if (relevantDocs && relevantDocs.length > 0) {
        console.log(`Found ${relevantDocs.length} relevant documents`)
        
        // Build context from retrieved documents
        contextText = relevantDocs
          .map((doc: any, idx: number) => `[Document ${idx + 1}]: ${doc.content.substring(0, 1000)}`)
          .join('\n\n')
        
        // Store citations for response
        citations = relevantDocs.map((doc: any) => ({
          id: doc.id,
          similarity: doc.similarity
        }))
      } else {
        console.log('No relevant documents found')
      }
    } catch (error: any) {
      console.error('RAG search error:', error)
      // Continue without RAG if search fails
    }

    // Prepare system prompt with context
    const systemPrompt = contextText
      ? `You are a helpful and enthusiastic college assistant chatbot.
You have access to the following information from college documents:

${contextText}

Use this information to answer the student's questions accurately.
If the information is in the documents above, cite it in your response.
If you don't know something or it's not in the documents, say so and advise them to contact the college administration.
Format your response using Markdown (bold, lists, etc.) where appropriate.

IMPORTANT: If anyone asks who developed you, who made you, or who created you, respond with:
"Those Backbenchers from ISE B section Pratham, Prashanth, Varun and Sumeeth developed me and I love them ❤️"`
      : `You are a helpful and enthusiastic college assistant chatbot.
Answer the student's questions about the college to the best of your ability.
If you don't know something, say so and advise them to contact the college administration.
Format your response using Markdown (bold, lists, etc.) where appropriate.

IMPORTANT: If anyone asks who developed you, who made you, or who created you, respond with:
"Those Backbenchers from ISE B section Pratham, Prashanth, Varun and Sumeeth developed me and I love them ❤️"`

    // Prepare messages for Bytez API (OpenAI-compatible format)
    const apiMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ]

    // Call Bytez API using OpenAI-compatible endpoint
    const response = await fetch('https://api.bytez.com/models/v2/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bytezApiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-4B-Instruct-2507',
        messages: apiMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Bytez API error:', response.status, errorText)
      throw new Error(`Bytez API returned ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content

    if (!responseText) {
      console.error('Invalid response from Bytez API:', data)
      throw new Error('Invalid response from AI model')
    }

    console.log(`Response generated successfully (${responseText.length} chars)`)

    return new Response(
      JSON.stringify({ 
        response: responseText,
        citations: citations.length > 0 ? citations : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Edge Function Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    // Provide user-friendly error messages
    let errorMessage = 'An unexpected error occurred'
    let statusCode = 500

    if (error.message?.includes('API key') || error.message?.includes('401')) {
      errorMessage = 'Invalid API key configuration'
    } else if (error.message?.includes('quota') || error.message?.includes('429')) {
      errorMessage = 'API quota exceeded. Please try again later.'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection and try again.'
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
