import pg from 'pg';
import type { ConversationStore } from './application/ports.js';
import { ReceiveWhatsappMessage } from './application/receive-whatsapp-message.js';
import { readConfig } from './config.js';
import { demoCollectionRequests } from './infrastructure/demo-collection-requests.js';
import { FileReplyPolicy } from './infrastructure/file-reply-policy.js';
import { HttpCollectionRequests } from './infrastructure/http-collection-requests.js';
import { MemoryConversationStore } from './infrastructure/memory-conversation-store.js';
import { PostgresConversationStore } from './infrastructure/postgres-conversation-store.js';
import { createWhatsappServer } from './infrastructure/twilio-webhook.js';

async function main(): Promise<void> {
  const config = readConfig(process.env);
  const replies = await FileReplyPolicy.open(config.replyFile, () => {
    console.warn('Reglas de respuesta inválidas o inaccesibles. Se conserva la última versión válida.');
  }).catch(() => {
    throw new Error('No se pudieron cargar las reglas de respuesta. Revisa config/replies.es.json o WHATSAPP_RULES_FILE.');
  });

  const collection = config.collection;
  let conversations: ConversationStore;
  let pool: pg.Pool | undefined;

  if (collection.mode === 'api') {
    pool = new pg.Pool({
      connectionString: collection.databaseUrl,
      connectionTimeoutMillis: 3_000,
      statement_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    pool.on('error', () => console.error('Se perdió una conexión inactiva de PostgreSQL.'));
    const postgres = new PostgresConversationStore(pool);
    try {
      await postgres.initialize();
    } catch {
      await pool.end();
      throw new Error('No se pudo preparar PostgreSQL. Revisa DATABASE_URL y los permisos del módulo.');
    }
    conversations = postgres;
  } else {
    conversations = new MemoryConversationStore();
  }

  const collections = collection.mode === 'api'
    ? new HttpCollectionRequests(collection.collectionUrl, collection.collectionToken)
    : demoCollectionRequests;
  const receiver = new ReceiveWhatsappMessage(conversations, collections, replies, config.pilotNumbers);
  const server = createWhatsappServer({
    authToken: config.authToken,
    webhookUrl: config.webhookUrl,
    contactAliases: config.contactAliases,
    receive: (message) => receiver.execute(message),
  });

  server.once('error', () => {
    console.error('No se pudo iniciar el servidor de WhatsApp. Revisa HOST y PORT.');
    process.exitCode = 1;
    void pool?.end();
  });
  server.listen(config.port, config.host, () => {
    console.info(`WhatsApp de EcoConecta escucha en ${config.host}:${config.port} (modo ${collection.mode}).`);
  });

  const close = () => server.close(() => { void pool?.end(); });
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar el módulo.');
  process.exitCode = 1;
});
