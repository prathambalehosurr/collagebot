import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages } = await req.json()
    const userMessage = messages[messages.length - 1].content

    // Get user ID from authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting: 10 requests per minute
    const RATE_LIMIT = 10
    const WINDOW_MINUTES = 1
    const endpoint = 'chat-handler'

    const { data: rateData, error: rateError } = await supabaseClient
      .from('rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
      .single()

    const now = new Date()
    
    if (rateData) {
      const windowStart = new Date(rateData.window_start)
      const minutesSinceStart = (now.getTime() - windowStart.getTime()) / (1000 * 60)

      if (minutesSinceStart < WINDOW_MINUTES) {
        // Within the same window
        if (rateData.request_count >= RATE_LIMIT) {
          const resetTime = new Date(windowStart.getTime() + WINDOW_MINUTES * 60 * 1000)
          return new Response(
            JSON.stringify({ 
              error: 'Rate limit exceeded. Please try again later.',
              resetAt: resetTime.toISOString()
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Increment count
        await supabaseClient
          .from('rate_limits')
          .update({ request_count: rateData.request_count + 1 })
          .eq('user_id', user.id)
          .eq('endpoint', endpoint)
      } else {
        // New window
        await supabaseClient
          .from('rate_limits')
          .update({ request_count: 1, window_start: now.toISOString() })
          .eq('user_id', user.id)
          .eq('endpoint', endpoint)
      }
    } else {
      // First request
      await supabaseClient
        .from('rate_limits')
        .insert({ user_id: user.id, endpoint, request_count: 1, window_start: now.toISOString() })
    }

    // 1. Initialize Gemini
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '')
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    // 2. Generate Embedding
    const embeddingResult = await embeddingModel.embedContent(userMessage)
    const embedding = embeddingResult.embedding.values

    // 3. Search Documents (RAG)

    const { data: docs, error: searchError } = await supabaseClient.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.1,
      match_count: 3
    })

    if (searchError) throw searchError

    let context = ''
    if (docs && docs.length > 0) {
      context = docs.map((d: any) => `Source: ${d.title}\n${d.content}`).join('\n\n---\n\n')
    }

    // 4. Generate Response
    const systemPrompt = `You are a helpful and enthusiastic college assistant chatbot.
    Use the following context to answer the student's question.
    If the answer is not in the context, say you don't know and advise them to contact the college administration.
    ALWAYS cite your sources if you use information from the context. Format citations as "[Source: Document Title]".
    Format your response using Markdown (bold, lists, etc.) where appropriate.
    
    Context:
    ${context}`

    const chat = chatModel.startChat({
      history: messages.slice(0, -1).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        maxOutputTokens: 1000,
      }
    })

    const result = await chat.sendMessage(userMessage + "\n\nSystem Instruction: " + systemPrompt)
    const responseText = result.response.text()

    // 5. Log Analytics Event
    const responseEndTime = Date.now()
    const responseTime = responseEndTime - Date.now() // This will be calculated from request start
    
    await supabaseClient.from('analytics_events').insert({
      event_type: 'chat_message',
      user_id: user.id,
      metadata: {
        question: userMessage.substring(0, 200), // Limit length
        response_time_ms: responseTime,
        documents_used: docs?.length || 0,
        has_context: context.length > 0
      }
    })

    return new Response(
      JSON.stringify({ response: responseText, context: docs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
