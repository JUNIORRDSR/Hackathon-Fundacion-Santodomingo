import { COLLECTION_FIELD_LIMITS, type CollectionDetails, type GeneratorType, type WasteType } from './collection.js';

type Started = { requestId: string; wasteType: WasteType };
type WithGenerator = Started & { generatorType: GeneratorType };
type WithAddress = WithGenerator & { address: string };
type WithAvailability = WithAddress & { availability: string };

type Draft =
  | (Started & { step: 'generator' })
  | (WithGenerator & { step: 'address' })
  | (WithAddress & { step: 'availability' })
  | (WithAvailability & { step: 'notes' })
  | (WithAvailability & { step: 'confirmation'; notes: string });

export interface Receipt {
  id: string;
  simulated: boolean;
}

export interface Conversation {
  draft: Draft | null;
  lastRequest?: Receipt;
}

export type Reply =
  | { kind: 'menu' | 'askGenerator' | 'askAddress' | 'askAvailability' | 'askNotes' | 'noRequest'
      | 'cancelled' | 'nothingToCancel' | 'textOnly' | 'invalidConfirmation' | 'serviceUnavailable' | 'pilotOnly' }
  | { kind: 'confirm'; values: CollectionDetails }
  | { kind: 'received' | 'simulated' | 'lastRequest' | 'lastSimulated'; values: { id: string } };

type Turn =
  | { reply: Reply; conversation: Conversation }
  | { submit: { requestId: string; details: CollectionDetails } };

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function detailsOf(draft: Extract<Draft, { step: 'confirmation' }>): CollectionDetails {
  const { wasteType, generatorType, address, availability, notes } = draft;
  return { wasteType, generatorType, address, availability, notes };
}

function currentQuestion(draft: Draft | null): Reply {
  switch (draft?.step) {
    case 'generator': return { kind: 'askGenerator' };
    case 'address': return { kind: 'askAddress' };
    case 'availability': return { kind: 'askAvailability' };
    case 'notes': return { kind: 'askNotes' };
    case 'confirmation': return { kind: 'confirm', values: detailsOf(draft) };
    default: return { kind: 'menu' };
  }
}

function plainText(value: string, limit: number, minimum = 2): boolean {
  return value.length >= minimum && value.length <= limit
    && !/[\p{Cc}\p{Cf}\p{Cs}\uFFFE\uFFFF]/u.test(value);
}

export function advanceConversation(
  conversation: Conversation,
  message: { messageId: string; body: string; hasMedia: boolean },
): Turn {
  const { draft, lastRequest } = conversation;
  const text = message.body.trim().replace(/\s+/gu, ' ');
  const choice = normalize(text);
  const reply = (output: Reply): Turn => ({ reply: output, conversation });
  const update = (nextDraft: Draft | null, output = currentQuestion(nextDraft)): Turn => ({
    reply: output,
    conversation: { ...conversation, draft: nextDraft },
  });

  if (!text || message.hasMedia) return reply({ kind: 'textOnly' });
  if (choice === 'menu' || choice === 'ayuda') return reply(currentQuestion(draft));
  if (choice === 'cancelar') {
    return draft ? update(null, { kind: 'cancelled' }) : reply({ kind: 'nothingToCancel' });
  }
  if (choice === 'estado') {
    if (!lastRequest) return reply({ kind: 'noRequest' });
    return reply({ kind: lastRequest.simulated ? 'lastSimulated' : 'lastRequest', values: { id: lastRequest.id } });
  }

  switch (draft?.step) {
    case 'generator': {
      if (['1', 'hogar'].includes(choice)) return update({ ...draft, step: 'address', generatorType: 'hogar' });
      if (['2', 'negocio', 'unidad productiva'].includes(choice)) {
        return update({ ...draft, step: 'address', generatorType: 'unidad_productiva' });
      }
      return reply(currentQuestion(draft));
    }
    case 'address':
      return plainText(text, COLLECTION_FIELD_LIMITS.address)
        ? update({ ...draft, step: 'availability', address: text }) : reply(currentQuestion(draft));
    case 'availability':
      return plainText(text, COLLECTION_FIELD_LIMITS.availability)
        ? update({ ...draft, step: 'notes', availability: text }) : reply(currentQuestion(draft));
    case 'notes':
      return plainText(text, COLLECTION_FIELD_LIMITS.notes, 1)
        ? update({ ...draft, step: 'confirmation', notes: choice === 'ninguna' ? '' : text })
        : reply(currentQuestion(draft));
    case 'confirmation':
      return ['si', 'confirmar'].includes(choice)
        ? { submit: { requestId: draft.requestId, details: detailsOf(draft) } }
        : reply({ kind: 'invalidConfirmation' });
    default:
      if (['1', 'organico', 'organicos'].includes(choice)) {
        return update({ step: 'generator', requestId: message.messageId, wasteType: 'organico' });
      }
      if (['2', 'reciclable', 'reciclables', 'aprovechable', 'aprovechables'].includes(choice)) {
        return update({ step: 'generator', requestId: message.messageId, wasteType: 'reciclable' });
      }
      return reply({ kind: 'menu' });
  }
}
