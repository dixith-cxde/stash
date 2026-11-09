import { router, usePathname } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

import { useCapture } from '@/state/capture';

import { addProcessTextListener, ExpressiveModule } from '../../../modules/expressive';
import { normalizeShare } from './normalize';

/** Bridges incoming shares and "Save to Stash" text selections into the capture screen. */
export function CaptureListener() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const pathname = usePathname();

  const openCapture = useEffectEvent((drafts: ReturnType<typeof normalizeShare>) => {
    if (!drafts.length) return;
    useCapture.getState().setDrafts(drafts, true);
    // The share deep link may already have routed to /capture; don't stack a second copy.
    if (pathname !== '/capture') setTimeout(() => router.push('/capture'), 0);
  });

  useEffect(() => {
    if (!hasShareIntent) return;
    openCapture(
      normalizeShare({
        text: shareIntent.text,
        webUrl: shareIntent.webUrl,
        files: shareIntent.files,
        sourceApp: shareIntent.meta?.title ?? null,
      }),
    );
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  useEffect(() => {
    const check = () => {
      const text = ExpressiveModule?.takePendingProcessText();
      if (text) openCapture(normalizeShare({ processText: text }));
    };
    check();
    const sub = addProcessTextListener((text) => {
      ExpressiveModule?.takePendingProcessText();
      openCapture(normalizeShare({ processText: text }));
    });
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      sub?.remove();
      appSub.remove();
    };
  }, []);

  return null;
}
