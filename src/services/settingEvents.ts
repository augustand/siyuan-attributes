export const SETTINGS_CHANGED_EVENT = "mux-attribute-panel:settings-changed";

export function emitSettingsChanged(): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
}

export function onSettingsChanged(listener: () => void): () => void {
  window.addEventListener(SETTINGS_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(SETTINGS_CHANGED_EVENT, listener);
  };
}
