import type { CollectionRequests } from '../application/ports.js';

export const demoCollectionRequests: CollectionRequests = {
  async submit({ requestId }) {
    return { id: `DEMO-${requestId.slice(-12).toUpperCase()}`, simulated: true };
  },
};
