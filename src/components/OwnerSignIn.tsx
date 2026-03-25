'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useOwner } from '@/components/OwnerProvider';

export default function OwnerSignIn() {
  const { isOwner } = useOwner();

  useHotkeys('ctrl+shift+l', () => {
    if (!isOwner) {
      window.location.href = '/api/auth/signin';
    }
  });

  // No visible UI
  return null;
}
