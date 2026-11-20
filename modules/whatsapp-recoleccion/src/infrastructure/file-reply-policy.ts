import { readFile } from 'node:fs/promises';
import type { ReplyPolicy } from '../application/ports.js';
import { COLLECTION_FIELD_LIMITS } from '../domain/collection.js';
import type { Reply } from '../domain/conversation.js';

const labels = {
  organico: 'Orgánicos',
  reciclable: 'Reciclables',
  hogar: 'Hogar',
  unidad_productiva: 'Unidad productiva',
} as const;

const confirmationFields = {
  ...COLLECTION_FIELD_LIMITS,
  wasteType: Math.max(labels.organico.length, labels.reciclable.length),
  generatorType: Math.max(labels.hogar.length, labels.unidad_productiva.length),
};

const receiptFields = { id: 80 };

const fieldsByReply = {
  menu: {},
  askGenerator: {},
  askAddress: {},
  askAvailability: {},
  askNotes: {},
  confirm: confirmationFields,
  received: receiptFields,
  simulated: receiptFields,
  lastRequest: receiptFields,
  lastSimulated: receiptFields,
  noRequest: {},
  cancelled: {},
  nothingToCancel: {},
  textOnly: {},
  invalidConfirmation: {},
  serviceUnavailable: {},
  pilotOnly: {},
} satisfies Record<Reply['kind'], Record<string, number>>;

type Rules = { messages: Record<Reply['kind'], string> };

function readRules(raw: string): Rules {
  const data = JSON.parse(raw) as { maxCharacters?: unknown; messages?: unknown } | null;
  const limit = data?.maxCharacters;
  const messages = data?.messages;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 1_600 ||
      typeof messages !== 'object' || messages === null || Array.isArray(messages) ||
      Object.keys(messages).length !== Object.keys(fieldsByReply).length) {
    throw new Error('Se requieren maxCharacters (1–1600) y todas las plantillas del módulo.');
  }

  for (const [kind, fields] of Object.entries(fieldsByReply)) {
    const template: unknown = Object.getOwnPropertyDescriptor(messages, kind)?.value;
    if (typeof template !== 'string' || !template.trim() ||
        /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(template)) {
      throw new Error(`Plantilla inválida: ${kind}.`);
    }

    const lengths: Record<string, number> = fields;
    const used = new Set<string>();
    const expanded = template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, field: string) => {
      if (!Object.hasOwn(lengths, field)) throw new Error(`Variable inválida en ${kind}.`);
      used.add(field);
      return 'X'.repeat(lengths[field]!);
    });
    if (used.size !== Object.keys(fields).length || /\{\{|\}\}/.test(expanded) || expanded.length > limit) {
      throw new Error(`Variables o longitud inválidas en ${kind}.`);
    }
  }

  return { messages: messages as Rules['messages'] };
}

export class FileReplyPolicy implements ReplyPolicy {
  private pending = Promise.resolve();
  private lastRead: string | null;

  private constructor(
    private readonly path: string,
    private rules: Rules,
    raw: string,
    private readonly onInvalid: () => void,
  ) {
    this.lastRead = raw;
  }

  static async open(path: string, onInvalid = () => {}): Promise<FileReplyPolicy> {
    const raw = await readFile(path, 'utf8');
    return new FileReplyPolicy(path, readRules(raw), raw, onInvalid);
  }

  async render(reply: Reply): Promise<string> {
    const reload = this.pending.then(() => this.reload());
    this.pending = reload.catch(() => {});
    await reload;

    const template = this.rules.messages[reply.kind];
    if (!('values' in reply)) return template;

    const values: Record<string, string> = reply.kind === 'confirm'
      ? {
          ...reply.values,
          wasteType: labels[reply.values.wasteType],
          generatorType: labels[reply.values.generatorType],
          notes: reply.values.notes || 'Ninguna',
        }
      : reply.values;

    return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, field: string) => values[field]!);
  }

  private async reload(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch {
      if (this.lastRead !== null) {
        this.lastRead = null;
        this.onInvalid();
      }
      return;
    }

    if (raw === this.lastRead) return;
    this.lastRead = raw;

    try {
      this.rules = readRules(raw);
    } catch {
      this.onInvalid();
    }
  }
}
