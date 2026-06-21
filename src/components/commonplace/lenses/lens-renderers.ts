'use client';

/**
 * Lens renderer registry — the (object-type, lens) dispatch table, the sibling
 * of ObjectRenderer's RENDERERS map. Each lens id maps to one lazy-loaded
 * renderer. A lens with no renderer falls back gracefully in LensPane (FR-005).
 */

import { lazy, type ComponentType } from 'react';
import type { LensViewProps } from './lens-types';

const TerminalLens = lazy(() => import('./TerminalLens'));
const ClusterLens = lazy(() => import('./ClusterLens'));
const TimelineLens = lazy(() => import('./TimelineLens'));
const NotesLens = lazy(() => import('./NotesLens'));
const TasksLens = lazy(() => import('./TasksLens'));
const ReminderLens = lazy(() => import('./ReminderLens'));
const PhotosLens = lazy(() => import('./PhotosLens'));

export const LENS_RENDERERS: Record<string, ComponentType<LensViewProps>> = {
  terminal: TerminalLens,
  cluster: ClusterLens,
  timeline: TimelineLens,
  notes: NotesLens,
  tasks: TasksLens,
  reminder: ReminderLens,
  photos: PhotosLens,
};
