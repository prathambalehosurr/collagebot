import { supabase } from './supabase';

/**
 * Generate a response using the Edge Function (which calls Bytez API)
 * @param {Array} messages - Chat history
 * @returns {Promise<{response: string, citations: Array}>}
 */
export async function generateResponse(messages) {
    try {
        const { data, error } = await supabase.functions.invoke('chat-handler', {
            body: { messages }
        });

        if (error) {
            console.error('Edge Function Error:', error);
            throw error;
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        if (!data || !data.response) {
            throw new Error('Invalid response from server');
        }

        // Return both response and citations
        return {
            response: data.response,
            citations: data.citations || []
        };
    } catch (error) {
        console.error('Chat Error:', error);

        // User-friendly error messages
        if (error.message?.includes('Rate limit')) {
            throw new Error('⏱️ You\'ve reached the message limit. Please wait a moment before sending more messages.');
        } else if (error.message?.includes('API key') || error.message?.includes('401')) {
            throw new Error('Authentication error. Please try logging in again.');
        } else if (error.message?.includes('quota') || error.message?.includes('429')) {
            throw new Error('Service quota exceeded. Please try again later.');
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            throw new Error('Network error. Please check your connection and try again.');
        }

        throw new Error(`Failed to generate response: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Generate embedding for text using the Edge Function
 * @param {string} text - Text to embed
 * @returns {Promise<number[]|null>} - Embedding vector or null
 */
export async function embedText(text) {
    try {
        const { data, error } = await supabase.functions.invoke('chat-handler', {
            body: { action: 'embed', text }
        });

        if (error) {
            console.error('Embedding Error:', error);
            throw new Error(`Embedding failed: ${error.message || 'Unknown server error'}`);
        }

        if (!data || !data.embedding) {
            if (data?.error) {
                throw new Error(`Embedding API error: ${data.error}`);
            }
            throw new Error('No embedding returned from server');
        }

        return data.embedding;
    } catch (error) {
        console.error('Embedding failed:', error);
        throw error; // Propagate error to caller
    }
}
