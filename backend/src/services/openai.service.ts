import OpenAI from 'openai';
import { config } from '../config';
import type { AITool, AIToolCall } from '../types';

const client = new OpenAI({ apiKey: config.openai.apiKey });

// ─── Chat Completions ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAI.ChatCompletionContentPart[];
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
}

interface ChatOptions {
  messages: ChatMessage[];
  tools?: AITool[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string | null;
  toolCalls: AIToolCall[] | null;
  finishReason: string;
}

export async function chatCompletion(options: ChatOptions): Promise<ChatResult> {
  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: options.messages as OpenAI.ChatCompletionMessageParam[],
    ...(options.tools && options.tools.length > 0 && {
      tools: options.tools as OpenAI.ChatCompletionTool[],
      tool_choice: 'auto',
    }),
    max_tokens: options.maxTokens ?? config.openai.maxTokens,
    temperature: options.temperature ?? config.openai.temperature,
  });

  const choice = response.choices[0];
  if (!choice) throw new Error('OpenAI returned no choices');

  return {
    content: choice.message.content,
    toolCalls: (choice.message.tool_calls as AIToolCall[]) ?? null,
    finishReason: choice.finish_reason ?? 'stop',
  };
}

// ─── Embeddings ────────────────────────────────────────────────────────────────

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: config.openai.embeddingModel,
    input: text.slice(0, 8191),
  });
  return response.data[0]!.embedding;
}

// ─── Transcription ─────────────────────────────────────────────────────────────

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'wav';
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: config.openai.whisperModel,
    file,
    response_format: 'text',
  });

  return String(response);
}

// ─── Urdu Romanization ─────────────────────────────────────────────────────────

export async function romanizeUrdu(urduText: string): Promise<string> {
  const result = await chatCompletion({
    messages: [
      {
        role: 'system',
        content:
          'You are a transliteration assistant. Convert Urdu script text to Roman Urdu. Return only the transliterated text, nothing else.',
      },
      { role: 'user', content: urduText },
    ],
    maxTokens: 500,
    temperature: 0,
  });
  return result.content ?? urduText;
}

// ─── Vision (image analysis) ───────────────────────────────────────────────────

export async function analyzeImage(base64Image: string, mimeType: string, context: string): Promise<string> {
  const result = await chatCompletion({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'auto' },
          },
          {
            type: 'text',
            text: `Analyze this image in the context of: ${context}. Describe what you see and any relevant details for customer support.`,
          },
        ],
      },
    ],
    maxTokens: 500,
  });
  return result.content ?? 'Unable to analyze image.';
}

// ─── Text Summarization ────────────────────────────────────────────────────────

export async function summarizeConversation(messages: string[]): Promise<string> {
  const result = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: 'Summarize this customer conversation in 2-3 sentences, highlighting: customer need, key info shared, and current status.',
      },
      { role: 'user', content: messages.join('\n') },
    ],
    maxTokens: 200,
    temperature: 0,
  });
  return result.content ?? '';
}
