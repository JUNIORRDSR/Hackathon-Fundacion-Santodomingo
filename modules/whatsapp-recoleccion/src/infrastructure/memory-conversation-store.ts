import type { ConversationStore } from '../application/ports.js';
import type { Conversation } from '../domain/conversation.js';

export class MemoryConversationStore implements ConversationStore {
  private readonly conversations = new Map<string, Conversation>();
  private readonly processed = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();

  async process(
    { contactPhone, messageId }: Parameters<ConversationStore['process']>[0],
    run: Parameters<ConversationStore['process']>[1],
  ): Promise<string | null> {
    const previous = this.pending.get(contactPhone) ?? Promise.resolve();
    const turn = previous.then(async () => {
      if (this.processed.has(messageId)) return null;

      const result = await run(this.conversations.get(contactPhone) ?? { draft: null });
      this.conversations.set(contactPhone, result.conversation);
      this.processed.add(messageId);
      return result.text;
    });
    const settled = turn.then(() => {}, () => {});
    this.pending.set(contactPhone, settled);

    try {
      return await turn;
    } finally {
      if (this.pending.get(contactPhone) === settled) this.pending.delete(contactPhone);
    }
  }
}
