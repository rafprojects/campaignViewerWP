import type { HttpTransport } from '../http/HttpTransport';

export interface WebhookEndpoint {
  index: number;
  url: string;
  /** Last 8 chars of the HMAC secret; never the full value. */
  secretHint: string;
  /** Event-type filter. Empty array means all events are delivered. */
  events: string[];
  enabled: boolean;
}

/** Shape returned on creation or secret rotation — one-time full secret. */
export interface WebhookEndpointWithSecret extends Omit<WebhookEndpoint, 'secretHint'> {
  secret: string;
  secretHint: string;
}

export interface WebhookDelivery {
  deliveryId: string;
  event: string;
  url: string;
  attempt: number;
  success: boolean;
  statusCode: number;
  timestamp: number;
}

export interface CreateWebhookEndpointRequest {
  url: string;
  events?: string[];
  enabled?: boolean;
}

export interface UpdateWebhookEndpointRequest {
  url?: string;
  events?: string[];
  enabled?: boolean;
}

export class WebhooksApi {
  constructor(private readonly transport: HttpTransport) {}

  listEndpoints(): Promise<WebhookEndpoint[]> {
    return this.transport.get<WebhookEndpoint[]>('/wp-json/wp-super-gallery/v1/webhooks');
  }

  createEndpoint(data: CreateWebhookEndpointRequest): Promise<WebhookEndpointWithSecret> {
    return this.transport.post<WebhookEndpointWithSecret>(
      '/wp-json/wp-super-gallery/v1/webhooks',
      data,
    );
  }

  updateEndpoint(index: number, data: UpdateWebhookEndpointRequest): Promise<WebhookEndpoint> {
    return this.transport.put<WebhookEndpoint>(
      `/wp-json/wp-super-gallery/v1/webhooks/${index}`,
      data,
    );
  }

  deleteEndpoint(index: number): Promise<{ deleted: boolean }> {
    return this.transport.delete<{ deleted: boolean }>(
      `/wp-json/wp-super-gallery/v1/webhooks/${index}`,
    );
  }

  rotateSecret(index: number): Promise<{ secret: string }> {
    return this.transport.post<{ secret: string }>(
      `/wp-json/wp-super-gallery/v1/webhooks/${index}/rotate-secret`,
      {},
    );
  }

  listDeliveries(limit = 50): Promise<WebhookDelivery[]> {
    return this.transport.get<WebhookDelivery[]>(
      `/wp-json/wp-super-gallery/v1/webhooks/delivery-log?limit=${limit}`,
    );
  }
}
