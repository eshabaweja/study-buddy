import {
  getLiteLlmHeaders,
  getLiteLlmUrl,
  getVisionModel,
} from '../config/llm.js';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const TRANSCRIBE_SYSTEM = `You transcribe PDFs and images into copyable plain text for an instructor to paste into course materials.

Rules:
- Preserve reading order, headings, lists, numbered problems, and table structure as text.
- Transcribe every visible word, number, equation, and label. Do not invent content that is not on the page.
- For diagrams or figures, describe them only enough that the text can stand in for the page (labels, values, topology). Do not solve problems or give answers.
- Use plain text. You may use simple markdown (headings, lists, tables) when it helps copy-paste.
- If the file has multiple pages, label them Page 1, Page 2, etc.`;

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export function mimeFromUpload(file) {
  const mime = (file.mimetype || '').toLowerCase();
  if (ALLOWED_MIMES.has(mime)) return mime;

  const ext = file.originalname?.split('.').pop()?.toLowerCase();
  return EXT_TO_MIME[ext] || null;
}

export function maxBytesForMime(_mimeType) {
  return MAX_UPLOAD_BYTES;
}

export function sizeLimitMessage(_mimeType) {
  return 'File must be 20MB or smaller';
}

function extractProviderMessage(errorText) {
  if (!errorText) return '';
  try {
    const parsed = JSON.parse(errorText);
    return (
      parsed.error?.message ||
      parsed.message ||
      parsed.error?.type ||
      ''
    );
  } catch {
    return errorText;
  }
}

export function userFacingTranscribeError(status, errorText) {
  const provider = String(extractProviderMessage(errorText) || errorText).toLowerCase();

  if (status === 413 || /too large|payload|max.*size|file size/i.test(provider)) {
    return 'This file is too large for the vision model. Try a file under 20MB.';
  }
  if (/page|too many pages/i.test(provider)) {
    return 'This PDF has too many pages. Split it into a shorter file and try again.';
  }
  if (/invalid|unsupported|could not|unable to|media type|pdf/i.test(provider)) {
    return 'Could not read this file. Use a PDF, JPEG, or PNG, and make sure the file is not password-protected or corrupted.';
  }
  if (status === 401 || status === 403) {
    return 'The transcription service is not available right now. Try again later.';
  }
  if (status === 429) {
    return 'The transcription service is busy. Wait a moment and try again.';
  }
  if (status >= 500 || /timeout|timed out|econnreset/i.test(provider)) {
    return 'Transcription timed out or the service failed. Try a smaller file, or try again.';
  }
  return 'Could not convert this file. Try a smaller PDF or a JPEG/PNG.';
}

export async function transcribeFileBuffer(buffer, filename, mimeType) {
  const base64 = Buffer.from(buffer).toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const kind = mimeType === 'application/pdf' ? 'PDF' : 'image';

  let response;
  try {
    response = await fetch(getLiteLlmUrl(), {
      method: 'POST',
      headers: getLiteLlmHeaders(),
      body: JSON.stringify({
        model: getVisionModel(),
        messages: [
          { role: 'developer', content: TRANSCRIBE_SYSTEM },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Transcribe this ${kind} (${filename}) into copyable text. Omit nothing labeled or written.`,
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        stream: false,
      }),
    });
  } catch (err) {
    throw new Error(userFacingTranscribeError(0, err.message));
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LiteLLM vision error:', response.status, errorText.slice(0, 2000));
    throw new Error(userFacingTranscribeError(response.status, errorText));
  }

  const completion = await response.json();
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('The model returned no text. Try a clearer scan or a smaller file.');
  }
  return text;
}
