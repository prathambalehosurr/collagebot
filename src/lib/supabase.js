import { createClient } from '@supabase/supabase-js';

// Validate environment variables
function validateEnvVars() {
  const requiredVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const errorMessage = `
🚨 Missing Environment Variables!

The following required environment variables are not set:
${missing.map(v => `  - ${v}`).join('\n')}

Please create a .env file in the root directory with:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here

See README.md for detailed setup instructions.
        `.trim();

    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Validate URL format
  try {
    new URL(requiredVars.VITE_SUPABASE_URL);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL');
  }

  return requiredVars;
}

const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = validateEnvVars();

export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY);

