/** Android's system Back key is handled separately from ordinary browser history.
 * Keep the web bundle dependency-free: Capacitor injects registerPlugin into
 * the native WebView, and the Android build installs @capacitor/app.
 */
export type BackAction = 'chapter' | 'dialog' | 'coach' | 'minimize';

export function chooseBackAction(dialogId: string | null, chapterOpen: boolean, coachVisible: boolean): BackAction {
  if (dialogId === 'levels-dialog' && chapterOpen) return 'chapter';
  if (dialogId !== null) return 'dialog';
  if (coachVisible) return 'coach';
  return 'minimize';
}

export interface NativeAppPlugin {
  addListener(event: 'backButton', callback: () => void): Promise<unknown>;
  minimizeApp(): Promise<void>;
}

export interface CapacitorBridge {
  getPlatform?(): string;
  isNativePlatform?(): boolean;
  Plugins?: { App?: NativeAppPlugin };
  registerPlugin?(name: 'App'): NativeAppPlugin;
}

/** Return false in a browser, where Escape/cancel remains the native dialog control. */
export function installAndroidBack(onBack: () => boolean, cap: CapacitorBridge | undefined): boolean {
  if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== 'android') return false;
  const app = cap.Plugins?.App ?? cap.registerPlugin?.('App');
  if (!app) return false;

  void app.addListener('backButton', () => {
    if (onBack()) return;
    // Keep the WebView and its local progress intact; don't navigate to a dead URL.
    void app.minimizeApp().catch((err: unknown) => console.warn('Could not minimize Android app', err));
  }).catch((err: unknown) => console.warn('Could not register Android Back button', err));
  return true;
}
