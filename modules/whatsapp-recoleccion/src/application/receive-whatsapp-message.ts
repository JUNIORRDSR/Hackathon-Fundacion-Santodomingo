import { collectionRequest } from '../domain/collection.js';
import { advanceConversation } from '../domain/conversation.js';
import type { Receipt } from '../domain/conversation.js';
import { CollectionServiceUnavailable } from './ports.js';
import type { CollectionRequests, ConversationStore, InboundWhatsappMessage, ReplyPolicy } from './ports.js';

export class ReceiveWhatsappMessage {
  constructor(
    private readonly conversations: ConversationStore,
    private readonly collections: CollectionRequests,
    private readonly replies: ReplyPolicy,
    private readonly pilotNumbers?: ReadonlySet<string>,
  ) {}

  async execute(message: InboundWhatsappMessage): Promise<string | null> {
    if (this.pilotNumbers && !this.pilotNumbers.has(message.contactPhone)) {
      return this.replies.render({ kind: 'pilotOnly' });
    }

    return this.conversations.process(message, async (conversation) => {
      const turn = advanceConversation(conversation, message);
      if ('reply' in turn) {
        return { conversation: turn.conversation, text: await this.replies.render(turn.reply) };
      }

      const { requestId, details } = turn.submit;
      let receipt: Receipt;
      try {
        receipt = await this.collections.submit(collectionRequest(requestId, message.contactPhone, details));
      } catch (error) {
        if (!(error instanceof CollectionServiceUnavailable)) throw error;
        return { conversation, text: await this.replies.render({ kind: 'serviceUnavailable' }) };
      }

      return {
        conversation: { draft: null, lastRequest: receipt },
        text: await this.replies.render({
          kind: receipt.simulated ? 'simulated' : 'received',
          values: { id: receipt.id },
        }),
      };
    });
  }
}
