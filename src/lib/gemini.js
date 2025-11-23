import { supabase } from './supabase';

/**
 * Generate a response using the secure Edge Function
 * @param {Array} messages - Chat history
 * @param {string} context - RAG context (optional, handled by Edge Function)
 */
export async function generateResponse(messages) {
    try {
        const { data, error } = await supabase.functions.invoke('chat-handler', {
            body: { messages }
        });

        if (error) {
            // Handle rate limiting
            if (error.message && error.message.includes('Rate limit exceeded')) {
                throw new Error('⏱️ You\'ve reached the message limit. Please wait a moment before sending more messages.');
            }
            throw error;
        }
        return data.response;
    } catch (error) {
        console.error('Edge Function Error:', error);

        // User-friendly error messages
        if (error.message.includes('Rate limit')) {
            throw error; // Already formatted
        }

        throw new Error(`Failed to generate response: ${error.message}`);
    }
}

/**
 * This function is no longer needed as embeddings are handled by the Edge Function
 * Keeping it for backward compatibility but it now calls the Edge Function
 */
export async function embedText(text) {
    // Edge Function handles embeddings internally
    // This is kept for compatibility but not used
    return null;
}
