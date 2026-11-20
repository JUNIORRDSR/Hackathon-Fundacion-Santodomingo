import { resolve } from 'node:path';
import { isContactPhone } from './domain/collection.js';
import { WHATSAPP_WEBHOOK_PATH } from './infrastructure/twilio-webhook.js';

type CollectionMode =
  | { mode: 'demo' }
  | { mode: 'api'; databaseUrl: string; collectionUrl: URL; collectionToken: string };

export function readConfig(env: NodeJS.ProcessEnv): {
  host: string;
  port: number;
  authToken: string;
  webhookUrl: string;
  replyFile: string;
  pilotNumbers?: ReadonlySet<string>;
  collection: CollectionMode;
} {
  function required(name: string): string {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Falta la variable ${name}.`);
    return value;
  }

  function webUrl(name: string, raw: string): URL {
    const url = URL.parse(raw);
    const loopback = url && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!url || url.username || url.password || url.hash ||
        (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) {
      throw new Error(`${name} debe ser una URL HTTPS sin credenciales ni fragmento; HTTP se permite en local.`);
    }
    return url;
  }

  const authToken = required('TWILIO_AUTH_TOKEN');
  const webhookUrl = required('TWILIO_WEBHOOK_URL');
  const webhook = webUrl('TWILIO_WEBHOOK_URL', webhookUrl);
  if (webhook.pathname !== WHATSAPP_WEBHOOK_PATH || !webhookUrl.endsWith(WHATSAPP_WEBHOOK_PATH) || webhook.search) {
    throw new Error(`TWILIO_WEBHOOK_URL debe terminar en ${WHATSAPP_WEBHOOK_PATH} sin parámetros.`);
  }

  const host = env.HOST?.trim() || '127.0.0.1';
  const port = Number(env.PORT?.trim() || '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }

  const numbers = env.WHATSAPP_PILOT_NUMBERS?.trim();
  const pilotNumbers = numbers ? numbers.split(',').map((number) => number.trim()) : undefined;
  if (pilotNumbers && !pilotNumbers.every(isContactPhone)) {
    throw new Error('WHATSAPP_PILOT_NUMBERS debe contener números en formato E.164 separados por comas.');
  }

  const mode = required('WHATSAPP_MODE');
  if (mode !== 'demo' && mode !== 'api') throw new Error('WHATSAPP_MODE debe ser demo o api.');
  const collection: CollectionMode = mode === 'demo' ? { mode } : {
    mode,
    databaseUrl: required('DATABASE_URL'),
    collectionUrl: webUrl('COLLECTION_API_URL', required('COLLECTION_API_URL')),
    collectionToken: required('COLLECTION_API_TOKEN'),
  };

  return {
    host,
    port,
    authToken,
    webhookUrl,
    replyFile: resolve(env.WHATSAPP_RULES_FILE?.trim() || 'config/replies.es.json'),
    pilotNumbers: pilotNumbers ? new Set(pilotNumbers) : undefined,
    collection,
  };
}
