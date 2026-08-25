'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandPalette, type CommandItem } from '@/lib/motion';
import '@/lib/motion/tokens.css';

// Product accent — HELIX Growth Doctor brand (globals.css --brand), fallback emerald.
const ACCENT = '#059669';

/**
 * HelixCommandBar — ⌘K / Ctrl+K navigation palette wired to the app's real routes.
 * Additive: mounted once in the root layout, owns its own open state, touches no
 * existing screen. Uses the shared @helix/motion CommandPalette primitive.
 */
export default function HelixCommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = useMemo<CommandItem[]>(
    () => [
      {
        id: 'home',
        title: 'לוח בקרה',
        subtitle: 'דף הבית',
        keywords: 'home dashboard funnel growth doctor לוח בקרה בית',
        run: () => router.push('/'),
      },
      {
        id: 'templates',
        title: 'ניהול תבניות WhatsApp',
        subtitle: 'תבניות',
        keywords: 'templates whatsapp תבניות ווטסאפ הודעות',
        run: () => router.push('/templates'),
      },
    ],
    [router]
  );

  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);

  return (
    <div dir="rtl" style={{ ['--hm-accent' as any]: ACCENT }}>
      <CommandPalette
        open={open}
        onOpen={onOpen}
        onClose={onClose}
        items={items}
        hotkey
        placeholder="חיפוש וניווט…  (⌘K)"
      />
    </div>
  );
}
