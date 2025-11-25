import { supabase } from './supabase';

/**
 * Generate a response using the Edge Function (which calls Bytez API)
 * @param {Array} messages - Chat history
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

        if (!data || !data.response) {
            throw new Error('Invalid response from server');
        }

        return data.response;
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
 * This function is no longer needed
 * Keeping it for backward compatibility
 */
export async function embedText(text) {
    return null;
}
