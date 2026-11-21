import type { CollectionRequest } from '../domain/collection.js';
import type { Conversation, Receipt, Reply } from '../domain/conversation.js';

export interface InboundWhatsappMessage {
  messageId: string;
  contactPhone: string;
  body: string;
  hasMedia: boolean;
}

export interface ConversationStore {
  process(
    input: Pick<InboundWhatsappMessage, 'contactPhone' | 'messageId'>,
    run: (conversation: Conversation) => Promise<{ conversation: Conversation; text: string }>,
  ): Promise<string | null>;
}

export interface CollectionRequests {
  submit(request: CollectionRequest): Promise<Receipt>;
}

export class CollectionServiceUnavailable extends Error {
  constructor() {
    super('El servicio de solicitudes no está disponible.');
  }
}

export interface ReplyPolicy {
  render(reply: Reply): Promise<string>;
}
