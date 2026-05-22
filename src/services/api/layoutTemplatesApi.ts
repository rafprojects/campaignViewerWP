import type { LayoutTemplate } from '@/types';
import type { HttpTransport } from '../http/HttpTransport';

/** Layout template response type — identical to the shared LayoutTemplate interface. */
export type LayoutTemplateResponse = LayoutTemplate;

/**
 * Domain module for layout template REST endpoints.
 */
export class LayoutTemplatesApi {
  constructor(private readonly transport: HttpTransport) {}

  getLayoutTemplates(): Promise<LayoutTemplateResponse[]> {
    return this.transport.get<LayoutTemplateResponse[]>(
      '/wp-json/wp-super-gallery/v1/admin/layout-templates',
    );
  }

  getLayoutTemplate(id: string): Promise<LayoutTemplateResponse> {
    return this.transport.get<LayoutTemplateResponse>(
      `/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}`,
    );
  }

  createLayoutTemplate(data: Partial<LayoutTemplateResponse>): Promise<LayoutTemplateResponse> {
    return this.transport.post<LayoutTemplateResponse>(
      '/wp-json/wp-super-gallery/v1/admin/layout-templates',
      data,
    );
  }

  updateLayoutTemplate(
    id: string,
    data: Partial<LayoutTemplateResponse>,
  ): Promise<LayoutTemplateResponse> {
    return this.transport.put<LayoutTemplateResponse>(
      `/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}`,
      data,
    );
  }

  deleteLayoutTemplate(id: string): Promise<{ deleted: boolean }> {
    return this.transport.delete<{ deleted: boolean }>(
      `/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}`,
    );
  }

  duplicateLayoutTemplate(id: string, name?: string): Promise<LayoutTemplateResponse> {
    return this.transport.post<LayoutTemplateResponse>(
      `/wp-json/wp-super-gallery/v1/admin/layout-templates/${encodeURIComponent(id)}/duplicate`,
      { name },
    );
  }

  /** Public endpoint — no admin auth required. Used for rendering. */
  getLayoutTemplatePublic(id: string): Promise<LayoutTemplateResponse> {
    return this.transport.get<LayoutTemplateResponse>(
      `/wp-json/wp-super-gallery/v1/layout-templates/${encodeURIComponent(id)}`,
    );
  }
}
