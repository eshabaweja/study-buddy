const DEFAULT_MODEL = 'claude-sonnet-4-6';
/** Strong multimodal model on OSU LiteLLM hub for detailed one-time figure captions. */
const DEFAULT_VISION_MODEL = 'claude-sonnet-4-6';

export function getTutorModel() {
  return process.env.LLM_TUTOR_MODEL || process.env.LLM_MODEL || DEFAULT_MODEL;
}

export function getGradingModel() {
  return process.env.LLM_GRADING_MODEL || process.env.LLM_MODEL || DEFAULT_MODEL;
}

export function getVisionModel() {
  return process.env.LLM_VISION_MODEL || DEFAULT_VISION_MODEL;
}

export function getLiteLlmUrl() {
  if (!process.env.LLM_BASE_URL) {
    throw new Error('LLM_BASE_URL environment variable is required');
  }
  return `${process.env.LLM_BASE_URL}/v1/chat/completions`;
}

export function getLiteLlmHeaders() {
  if (!process.env.LLM_API_KEY) {
    throw new Error('LLM_API_KEY environment variable is required');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
  };
}
