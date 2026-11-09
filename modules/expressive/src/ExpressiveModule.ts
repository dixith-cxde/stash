import { type EventSubscription, NativeModule, requireOptionalNativeModule } from 'expo';

type ExpressiveEvents = {
  onProcessText(event: { text: string }): void;
};

export type PdfPageRender = { uri: string; width: number; height: number; pageCount: number };

declare class ExpressiveNativeModule extends NativeModule<ExpressiveEvents> {
  takePendingProcessText(): string | null;
  renderPdfPage(source: string, output: string, width: number, page: number): Promise<PdfPageRender>;
}

/** Null on iOS/web and in Expo Go; callers must handle the absence. */
export const ExpressiveModule = requireOptionalNativeModule<ExpressiveNativeModule>('Expressive');

export function addProcessTextListener(listener: (text: string) => void): EventSubscription | null {
  return ExpressiveModule?.addListener('onProcessText', (e) => listener(e.text)) ?? null;
}
