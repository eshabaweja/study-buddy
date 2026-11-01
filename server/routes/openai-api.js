import 'dotenv/config';
import express from 'express';
import { getLlmHeaders, getLlmUrl, getTutorModel } from '../config/llm.js';
import { ensureFigureDescription } from '../services/figureDescription.js';

const router = express.Router();

// Validate API key and base URL exist
if (!process.env.LLM_API_KEY) {
  throw new Error('LLM_API_KEY environment variable is required');
}
if (!process.env.LLM_BASE_URL) {
  throw new Error('LLM_BASE_URL environment variable is required');
}

// In-memory chatbot configuration
const chatbotConfig = {
  role: "developer",
  content: `
You are Study Buddy, a concise Socratic tutor.
Use ONLY the provided context for teaching (goal, explicit/implicit data, solution, figureDescription).
If figureDescription is present, treat it as what the student can see in the prompt figure(s).

Accepting answers vs teaching:
- When the student proposes a final answer or solution: accept it if it is correct, even if their method differs from the provided solution. Do not require matching the instructor's steps.
- When teaching, hinting, or guiding: follow the provided solution path and context only. Do not invent alternate methods or curricula.

Flow:
1. Verify the student's stated goal.
2. Elicit explicit data (directly stated facts). If student stalls, reveal 1-2 items.
3. Elicit implicit data (prior knowledge). Give progressively stronger hints; never dump all at once.
4. Guide toward the provided plain English solution outline (NOT math steps) before any formal math.
5. If the student is already correct (by any valid method), acknowledge briefly and congratulate; you may then optionally offer the instructor approach as an alternative, without insisting on it.

Rules:
- One short hint or question at a time (<= 3 sentences).
- Never invent data or concepts.
- Prioritize the most relevant concept names when hinting.
- If student requests "hint", supply the next logical nudge along the provided solution path.
- Never mark a correct answer wrong because it used a different valid method.
`};

// Default question data (fallback)
const defaultQuestionData = {
  goal: "Find the factorial of 5",
  implicitData: "the formula for factorial is n! = n * (n-1) * (n-2) * ... * 1",
  explicitData: "n = 5",
  solution: "The factorial of 5 is 120"
};

router.post('/', async (req, res) => {
  try {
    const { userMessage, chatHistory, questionData, questionId, stream } = req.body;
    
    // Use provided question data or fall back to default
    const currentQuestionData = { ...(questionData || defaultQuestionData) };

    if (questionId && !currentQuestionData.figureDescription) {
      const description = await ensureFigureDescription(questionId);
      if (description) {
        currentQuestionData.figureDescription = description;
      }
    }
    
    const messages = [
      {
        role: chatbotConfig.role,
        content: chatbotConfig.content
      },
      {
        role: "developer",
        content: "Here's the question data: " + JSON.stringify(currentQuestionData)
      },
      ...chatHistory
    ];
    
    if (userMessage) {
      messages.push({
        role: 'user',
        content: userMessage
      });
    }

    // Use LLM HTTP API directly for optimized performance
    const shouldStream = stream !== false; // Default to streaming for better UX
    
    const requestBody = {
      model: getTutorModel(),
      messages: messages,
      temperature: 0.7,
      stream: shouldStream
    };

    // Make request to LLM API
    const llmUrl = getLlmUrl();
    
    if (shouldStream) {
      // Handle streaming response for better performance
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: getLlmHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API Error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let usage = null;
      let model = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write(`data: ${JSON.stringify({ done: true, usage, model })}\n\n`);
                res.end();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.model) {
                  model = parsed.model;
                }

                if (parsed.choices && parsed.choices[0]) {
                  const delta = parsed.choices[0].delta;
                  if (delta && delta.content) {
                    fullResponse += delta.content;
                    res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
                  }
                }

                if (parsed.usage) {
                  usage = parsed.usage;
                }
              } catch (e) {
                // Skip invalid JSON chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Send final response with usage info
      res.write(`data: ${JSON.stringify({ done: true, usage, model, fullResponse })}\n\n`);
      res.end();
    } else {
      // Non-streaming response (fallback)
      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: getLlmHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API Error: ${response.status} - ${errorText}`);
      }

      const completion = await response.json();
      const reply = completion.choices[0].message.content;
      
      if (!reply) {
        throw new Error('No response received from LLM');
      }

      res.json({ 
        reply,
        usage: completion.usage,
        model: completion.model
      });
    }
    
  } catch (error) {
    console.error('LLM API Error:', error);
    if (res.writableEnded) return;
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'Internal server error', message: error.message })}\n\n`);
      res.end();
      return;
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

export default router; 