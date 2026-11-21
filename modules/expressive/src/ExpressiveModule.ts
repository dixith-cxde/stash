import { type EventSubscription, NativeModule, requireOptionalNativeModule } from 'expo';

type ExpressiveEvents = {
  onProcessText(event: { text: string }): void;
  onUpdateProgress(event: { received: number; total: number }): void;
  onQuickSave(event: Record<string, never>): void;
};

/** A link the home-screen widget saved without opening the app; `at` is ms since epoch. */
export type QuickSave = { url: string; at: number };

export type PdfPageRender = { uri: string; width: number; height: number; pageCount: number };

declare class ExpressiveNativeModule extends NativeModule<ExpressiveEvents> {
  takePendingProcessText(): string | null;
  /** Links the widget's Paste link saved while the app was closed (cleared on read). */
  takeQuickSaves(): QuickSave[];
  renderPdfPage(source: string, output: string, width: number, page: number): Promise<PdfPageRender>;
  /** Downloads an APK into cache/updates; resolves with its file path. Progress: onUpdateProgress. */
  downloadUpdate(url: string, name: string): Promise<string>;
  /** "Install unknown apps" is allowed for Stash. */
  canInstallUpdates(): boolean;
  /** Opens Settings → Install unknown apps for Stash. */
  openInstallPermission(): void;
  /** Opens a saved file in its default app (Android asks when there is none). False when nothing can open it. */
  openFile(uri: string, mimeType: string | null): boolean;
  /** Hands a downloaded APK to the system installer. */
  installUpdate(path: string): void;
  /** Wallpaper colors: `seed` on Android 12+, plus platform color roles on Android 14+. */
  getDynamicColors(dark: boolean): (Partial<Record<string, string>> & { seed?: string }) | null;
}

/** Null on iOS/web and in Expo Go; callers must handle the absence. */
export const ExpressiveModule = requireOptionalNativeModule<ExpressiveNativeModule>('Expressive');

export function addProcessTextListener(listener: (text: string) => void): EventSubscription | null {
  return ExpressiveModule?.addListener('onProcessText', (e) => listener(e.text)) ?? null;
}

export function addUpdateProgressListener(listener: (received: number, total: number) => void): EventSubscription | null {
  return ExpressiveModule?.addListener('onUpdateProgress', (e) => listener(e.received, e.total)) ?? null;
}

/** Fires while the app is running when the widget queues a link (take it with takeQuickSaves). */
export function addQuickSaveListener(listener: () => void): EventSubscription | null {
  return ExpressiveModule?.addListener('onQuickSave', () => listener()) ?? null;
}
