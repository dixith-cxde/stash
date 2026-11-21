import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useEffectEvent, useRef } from 'react';
import { AppState } from 'react-native';

import { useCapture } from '@/state/capture';

import { addProcessTextListener, addQuickSaveListener, ExpressiveModule } from '../../../modules/expressive';
import { hostOf, normalizeShare } from './normalize';
import { saveDraft } from './save';

let draining = false;

/**
 * Saves links the widget's Paste link queued (natively, without opening the app) through the
 * normal save path: duplicate check, then the preview fetch fills title and image.
 */
async function drainQuickSaves() {
  if (draining) return;
  draining = true;
  try {
    for (const { url } of ExpressiveModule?.takeQuickSaves() ?? []) {
      try {
        await saveDraft({ kind: 'bookmark', type: 'link', url, title: hostOf(url) });
      } catch {
        // One bad link must not drop the rest.
      }
    }
  } finally {
    draining = false;
  }
}

/** Bridges incoming shares and "Save to Stash" text selections into the capture screen. */
export function CaptureListener() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const pathname = usePathname();
  // On a cold start the text arrives before the navigator is mounted; pushing then is lost.
  const navReady = !!useRootNavigationState()?.key;
  const waiting = useRef(false);

  const showCapture = useEffectEvent(() => {
    waiting.current = false;
    // The share deep link may already have routed to /capture; don't stack a second copy.
    if (pathname !== '/capture') setTimeout(() => router.push('/capture'), 0);
  });

  const openCapture = useEffectEvent((drafts: ReturnType<typeof normalizeShare>) => {
    if (!drafts.length) return;
    useCapture.getState().setDrafts(drafts, true);
    if (navReady) showCapture();
    else waiting.current = true;
  });

  useEffect(() => {
    if (navReady && waiting.current) showCapture();
  }, [navReady]);

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
      void drainQuickSaves();
      const text = ExpressiveModule?.takePendingProcessText();
      if (text) openCapture(normalizeShare({ processText: text }));
    };
    check();
    const sub = addProcessTextListener((text) => {
      ExpressiveModule?.takePendingProcessText();
      openCapture(normalizeShare({ processText: text }));
    });
    const quickSub = addQuickSaveListener(() => void drainQuickSaves());
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      sub?.remove();
      quickSub?.remove();
      appSub.remove();
    };
  }, []);

  return null;
}
