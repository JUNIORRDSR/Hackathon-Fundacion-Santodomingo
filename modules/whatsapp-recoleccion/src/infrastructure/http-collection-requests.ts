import { CollectionServiceUnavailable, type CollectionRequests } from '../application/ports.js';
import type { CollectionRequest } from '../domain/collection.js';
import type { Receipt } from '../domain/conversation.js';

export class HttpCollectionRequests implements CollectionRequests {
  constructor(
    private readonly url: URL,
    private readonly token: string,
    private readonly timeoutMs = 4_000,
  ) {}

  async submit(request: CollectionRequest): Promise<Receipt> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${this.token}`,
          'idempotency-key': request.requestId,
        },
        body: JSON.stringify(request),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        await response.body?.cancel();
        throw new CollectionServiceUnavailable();
      }

      const payload: unknown = await response.json();
      if (typeof payload === 'object' && payload !== null &&
          'id' in payload && typeof payload.id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(payload.id) &&
          'status' in payload && payload.status === 'recibida') {
        return { id: payload.id, simulated: false };
      }
    } catch {
      throw new CollectionServiceUnavailable();
    }
    throw new CollectionServiceUnavailable();
  }
}
