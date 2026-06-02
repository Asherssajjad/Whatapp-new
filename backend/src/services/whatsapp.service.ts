import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

interface SendTextOptions {
  to: string;
  body: string;
  previewUrl?: boolean;
}

interface ButtonOption {
  id: string;
  title: string;
}

interface SendButtonsOptions {
  to: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: ButtonOption[];
}

interface ListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

interface SendListOptions {
  to: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttonText: string;
  sections: ListSection[];
}

interface SendImageOptions {
  to: string;
  imageUrl?: string;
  imageId?: string;
  caption?: string;
}

interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}

export class WhatsAppService {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor(phoneNumberId: string, accessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.client = axios.create({
      baseURL: `${config.whatsapp.baseUrl}/${config.whatsapp.graphApiVersion}/${phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  private async post(endpoint: string, data: unknown): Promise<unknown> {
    try {
      const res = await this.client.post(endpoint, data);
      return res.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      const detail = error.response?.data ?? error.message;
      console.error(`[WA:${this.phoneNumberId}] POST ${endpoint} failed:`, detail);
      throw new Error(`WhatsApp API error: ${JSON.stringify(detail)}`);
    }
  }

  async sendText({ to, body, previewUrl = false }: SendTextOptions): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: previewUrl, body },
    });
  }

  async sendButtons({ to, headerText, bodyText, footerText, buttons }: SendButtonsOptions): Promise<void> {
    if (buttons.length > 3) buttons = buttons.slice(0, 3);
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText && { header: { type: 'text', text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: {
          buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })),
        },
      },
    });
  }

  async sendList({ to, headerText, bodyText, footerText, buttonText, sections }: SendListOptions): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(headerText && { header: { type: 'text', text: headerText } }),
        body: { text: bodyText },
        ...(footerText && { footer: { text: footerText } }),
        action: { button: buttonText, sections },
      },
    });
  }

  async sendImage({ to, imageUrl, imageId, caption }: SendImageOptions): Promise<void> {
    const imagePayload = imageId
      ? { id: imageId, ...(caption && { caption }) }
      : { link: imageUrl, ...(caption && { caption }) };

    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: imagePayload,
    });
  }

  async sendTemplate({ to, templateName, languageCode = 'en', components }: SendTemplateOptions): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && { components }),
      },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch {
      // non-critical, swallow silently
    }
  }

  async downloadMedia(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const res = await axios.get(
      `${config.whatsapp.baseUrl}/${config.whatsapp.graphApiVersion}/${mediaId}`,
      { headers: { Authorization: this.client.defaults.headers?.['Authorization'] } }
    );
    return { url: res.data.url, mimeType: res.data.mime_type };
  }

  async downloadMediaBuffer(url: string): Promise<Buffer> {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: this.client.defaults.headers?.['Authorization'] },
    });
    return Buffer.from(res.data);
  }
}

// Factory — create a service instance from a WhatsAppNumber record
export function createWAService(number: { phoneNumberId: string; accessToken: string }): WhatsAppService {
  return new WhatsAppService(number.phoneNumberId, number.accessToken);
}
