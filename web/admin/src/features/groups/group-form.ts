import { z } from 'zod';
import type { AdminCreateGroupInput, GroupDetail } from './types';

// Mirrors AdminGroupService: slug and displayName required and trimmed; slug is
// lowercased. Description is optional (empty becomes null).
export const groupFormSchema = z.object({
  slug: z.string().trim().min(1, 'Slug is required.'),
  displayName: z.string().trim().min(1, 'Display name is required.'),
  description: z.string().trim(),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;

export function toGroupInput(values: GroupFormValues): AdminCreateGroupInput {
  return {
    slug: values.slug.toLowerCase(),
    displayName: values.displayName,
    description: values.description || null,
  };
}

export function toGroupFormValues(group: GroupDetail): GroupFormValues {
  return {
    slug: group.slug,
    displayName: group.displayName,
    description: group.description ?? '',
  };
}
