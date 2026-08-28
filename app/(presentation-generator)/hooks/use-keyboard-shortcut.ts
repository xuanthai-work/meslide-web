import { useEffect, useRef } from 'react';

type KeyboardEvent = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  preventDefault: () => void;
};

export const useKeyboardShortcut = (
  keys: string[],
  callback: (e: KeyboardEvent) => void,
) => {
  const keysRef = useRef(keys);
  const callbackRef = useRef(callback);

  useEffect(() => {
    keysRef.current = keys;
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event as unknown as globalThis.KeyboardEvent).defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      const isTemplateV2KonvaShortcut =
        typeof document !== "undefined" &&
        Boolean(document.documentElement.dataset.templateV2KonvaActiveSurface) &&
        (key === "z" || key === "y");
      if (isTemplateV2KonvaShortcut) {
        return;
      }

      const isCtrlPressed = event.ctrlKey;
      
      if (keysRef.current.includes(key) && isCtrlPressed) {
        event.preventDefault();
        callbackRef.current(event);
      }
    };

    document.addEventListener('keydown', handleKeyPress as any);
    return () => {
      document.removeEventListener('keydown', handleKeyPress as any);
    };
  }, []);
};
