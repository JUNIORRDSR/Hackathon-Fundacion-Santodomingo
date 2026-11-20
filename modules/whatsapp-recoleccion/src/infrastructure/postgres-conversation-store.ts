import type { Pool } from 'pg';
import type { ConversationStore } from '../application/ports.js';
import type { Conversation } from '../domain/conversation.js';

export class PostgresConversationStore implements ConversationStore {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    const connection = await this.pool.connect();
    try {
      await connection.query('BEGIN');
      await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('ecoconecta_whatsapp_schema', 0))");
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ecoconecta_whatsapp_conversation (
          phone text PRIMARY KEY,
          conversation jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS ecoconecta_whatsapp_delivery (
          message_id text PRIMARY KEY,
          received_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await connection.query('COMMIT');
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }

  async process(
    { contactPhone, messageId }: Parameters<ConversationStore['process']>[0],
    run: Parameters<ConversationStore['process']>[1],
  ): Promise<string | null> {
    const connection = await this.pool.connect();
    try {
      await connection.query('BEGIN');
      // Serialize each phone across processes without blocking other conversations.
      await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [contactPhone]);
      const delivery = await connection.query(`
        INSERT INTO ecoconecta_whatsapp_delivery (message_id)
        VALUES ($1) ON CONFLICT DO NOTHING RETURNING message_id
      `, [messageId]);

      if (delivery.rowCount === 0) {
        await connection.query('COMMIT');
        return null;
      }

      const stored = await connection.query<{ conversation: Conversation }>(`
        SELECT conversation FROM ecoconecta_whatsapp_conversation WHERE phone = $1
      `, [contactPhone]);
      const result = await run(stored.rows[0]?.conversation ?? { draft: null });
      await connection.query(`
        INSERT INTO ecoconecta_whatsapp_conversation (phone, conversation)
        VALUES ($1, $2)
        ON CONFLICT (phone) DO UPDATE SET conversation = EXCLUDED.conversation, updated_at = now()
      `, [contactPhone, result.conversation]);
      await connection.query('COMMIT');
      return result.text;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }
}
