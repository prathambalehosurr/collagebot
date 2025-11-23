import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Required for client-side usage
});

export async function generateResponse(messages, context = '') {
    if (!apiKey) {
        throw new Error('OpenAI API Key is missing');
    }

    const systemMessage = {
        role: 'system',
        content: `You are a helpful college chatbot assistant. 
    Use the following context to answer the user's question. 
    If the answer is not in the context, say "I don't have information about that based on the uploaded documents."
    
    Context:
    ${context}
    `
    };

    try {
        const completion = await openai.chat.completions.create({
            messages: [systemMessage, ...messages],
            model: 'gpt-3.5-turbo', // Cost-effective model
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error generating response:', error);
        // Log more details if available
        if (error.response) {
            console.error('OpenAI API Error Data:', error.response.data);
            console.error('OpenAI API Error Status:', error.response.status);
        }
        throw error;
    }
}
