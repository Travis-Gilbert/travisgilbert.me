'use client';

/**
 * Attachment-lens persistence seam (FR-040 / FR-041).
 *
 * Notes mint a first-class note item via gqlPutNote — live on the GraphQL
 * consumer backend, and itself an object (so it shows up in the target's
 * Cluster/Timeline, FR-041). Tasks / Reminder / Photos persist through the
 * established component seam (createObjectComponent + object-detail.components),
 * the same model the toolbox already used; that path is live when the REST /
 * component backend is configured.
 *
 * Listing reads the object detail's components, backend-aware via
 * fetchObjectDetail. Callers also keep optimistic session state so a
 * just-added attachment shows immediately.
 */

import { gqlPutNote, itemToObjectListItem } from '@/lib/commonplace-graphql';
import { createObjectComponent, fetchObjectDetail } from '@/lib/commonplace-api';
import type { LensDef, LensContext } from '@/lib/commonplace-lenses';
import type { ApiComponent } from '@/lib/commonplace';

export interface AttachmentRecord {
  id: string;
  lensId: string;
  value: string;
  /** Slug of the created object, when the attachment minted a first-class item. */
  itemSlug?: string;
}

/** Persist a new attachment of `lens` on the target object. Throws on failure. */
export async function createAttachment(
  lens: LensDef,
  ctx: LensContext,
  value: string,
): Promise<AttachmentRecord> {
  if (lens.id === 'notes') {
    const item = await gqlPutNote(`Note · ${ctx.objectTitle}`.slice(0, 120), value, ['attachment', `on:${ctx.objectSlug}`]);
    const li = itemToObjectListItem(item);
    return { id: String(li.id), lensId: lens.id, value, itemSlug: li.slug };
  }
  const created = await createObjectComponent(ctx.objectRef, {
    component_type_slug: lens.apiTypeName,
    key: lens.id,
    value,
  });
  return { id: String(created.id), lensId: lens.id, value };
}

/** Existing component attachments of this lens on the object (best-effort, backend-aware). */
export async function listComponentAttachments(
  slug: string,
  lens: LensDef,
): Promise<ApiComponent[]> {
  try {
    const detail = await fetchObjectDetail(slug);
    return (detail.components ?? []).filter(
      (c) => c.component_type_name === lens.apiTypeName || c.key === lens.id,
    );
  } catch {
    return [];
  }
}
