import { createServer, type IncomingMessage, type Server } from 'node:http';
import { URLSearchParams } from 'node:url';
import twilio from 'twilio';
import type { InboundWhatsappMessage } from '../application/ports.js';

export const WHATSAPP_WEBHOOK_PATH = '/webhooks/twilio/whatsapp';

const MAX_FORM_BYTES = 32 * 1024;
const WHATSAPP_ADDRESS = /^whatsapp:(\+[1-9][0-9]{1,14})$/;
const MESSAGE_SID = /^(SM|MM)[0-9a-fA-F]{32}$/;

type FormParams = Record<string, string | string[] | undefined>;

interface WhatsappServerOptions {
  authToken: string;
  webhookUrl: string;
  receive: (input: InboundWhatsappMessage) => Promise<string | null>;
}

async function readForm(request: IncomingMessage): Promise<FormParams | null> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_FORM_BYTES) return null;
    chunks.push(chunk);
  }

  const params: FormParams = Object.create(null);
  for (const [key, value] of new URLSearchParams(Buffer.concat(chunks).toString('utf8'))) {
    const previous = params[key];
    if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      params[key] = previous === undefined ? value : [previous, value];
    }
  }
  return params;
}

function toInboundMessage(params: FormParams): InboundWhatsappMessage | null {
  const { MessageSid, From, To, Body = '', NumMedia = '0' } = params;
  const contactPhone = typeof From === 'string' ? WHATSAPP_ADDRESS.exec(From)?.[1] : undefined;

  if (
    !contactPhone ||
    typeof To !== 'string' || !WHATSAPP_ADDRESS.test(To) ||
    typeof MessageSid !== 'string' || !MESSAGE_SID.test(MessageSid) ||
    typeof Body !== 'string' ||
    typeof NumMedia !== 'string' || !/^[0-9]+$/.test(NumMedia)
  ) {
    return null;
  }

  return { messageId: MessageSid, contactPhone, body: Body, hasMedia: Number(NumMedia) > 0 };
}

export function createWhatsappServer({ authToken, webhookUrl, receive }: WhatsappServerOptions): Server {
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ok');
      return;
    }
    if (request.url !== WHATSAPP_WEBHOOK_PATH) {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return;
    }

    const contentType = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'application/x-www-form-urlencoded') {
      response.writeHead(415).end();
      return;
    }
    const signature = request.headers['x-twilio-signature'];
    if (typeof signature !== 'string' || !signature) {
      response.writeHead(403).end();
      return;
    }

    try {
      const params = await readForm(request);
      if (!params) {
        response.writeHead(413, { Connection: 'close' }).end();
        return;
      }
      if (!twilio.validateRequest(authToken, signature, webhookUrl, params)) {
        response.writeHead(403).end();
        return;
      }
      const message = toInboundMessage(params);
      if (!message) {
        response.writeHead(400).end();
        return;
      }

      const reply = await receive(message);
      const twiml = new twilio.twiml.MessagingResponse();
      if (reply !== null) twiml.message(reply);
      const xml = twiml.toString();
      response.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' }).end(xml);
    } catch {
      response.writeHead(500).end();
    }
  });
}
