import { transcribeAudio, romanizeUrdu } from './openai.service';

const URDU_REGEX = /[؀-ۿ]/;

export async function processVoiceMessage(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ transcript: string; wasUrdu: boolean }> {
  const raw = await transcribeAudio(audioBuffer, mimeType);

  const hasUrdu = URDU_REGEX.test(raw);
  if (!hasUrdu) return { transcript: raw, wasUrdu: false };

  const romanized = await romanizeUrdu(raw);
  return { transcript: romanized, wasUrdu: true };
}
