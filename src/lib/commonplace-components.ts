export interface ComponentToolboxItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  apiTypeName: string;
}

export const COMPONENT_TOOLBOX: ComponentToolboxItem[] = [
  { id: 'terminal',  label: 'Terminal',  icon: 'terminal',       color: '#2D5F6B', description: 'Engine analysis scoped to this object', apiTypeName: 'terminal' },
  { id: 'photos',    label: 'Photos',    icon: 'media-image',    color: '#C49A4A', description: 'Image collection', apiTypeName: 'file' },
  { id: 'cluster',   label: 'Cluster',   icon: 'network-right',  color: '#7050A0', description: 'Nearest connections mini-graph', apiTypeName: 'cluster' },
  { id: 'tasks',     label: 'Tasks',     icon: 'check',          color: '#B85C28', description: 'Checklist', apiTypeName: 'task' },
  { id: 'notes',     label: 'Notes',     icon: 'edit-pencil',    color: '#78767E', description: 'Rich text notes block', apiTypeName: 'text' },
  { id: 'reminder',  label: 'Reminder',  icon: 'bell',           color: '#C4503C', description: 'Time-triggered resurface', apiTypeName: 'reminder' },
  { id: 'timeline',  label: 'Timeline',  icon: 'clock',          color: '#3858B8', description: 'Scoped event timeline', apiTypeName: 'timeline' },
];
