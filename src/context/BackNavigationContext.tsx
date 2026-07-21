import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Capacitor } from '@capacitor/core';

export type BackHandler = () => boolean;

type BackNavigationContextValue = {
  pushHandler: (id: string, handler: BackHandler) => void;
  popHandler: (id: string) => void;
};

const BackNavigationContext = createContext<BackNavigationContextValue | null>(null);

type BackNavigationProviderProps = {
  children: React.ReactNode;
  onRootBack: () => void;
};

/** Android hardware back — nested screens register handlers; root shows exit confirm. */
export const BackNavigationProvider: React.FC<BackNavigationProviderProps> = ({
  children,
  onRootBack,
}) => {
  const handlersRef = useRef<Map<string, BackHandler>>(new Map());
  const orderRef = useRef<string[]>([]);
  const onRootBackRef = useRef(onRootBack);

  useEffect(() => {
    onRootBackRef.current = onRootBack;
  }, [onRootBack]);

  const pushHandler = useCallback((id: string, handler: BackHandler) => {
    handlersRef.current.set(id, handler);
    orderRef.current = orderRef.current.filter((entry) => entry !== id);
    orderRef.current.push(id);
  }, []);

  const popHandler = useCallback((id: string) => {
    handlersRef.current.delete(id);
    orderRef.current = orderRef.current.filter((entry) => entry !== id);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    void (async () => {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('backButton', () => {
        for (let i = orderRef.current.length - 1; i >= 0; i -= 1) {
          const id = orderRef.current[i];
          const handler = handlersRef.current.get(id);
          if (handler?.()) return;
        }
        onRootBackRef.current();
      });
      removeListener = () => {
        void handle.remove();
      };
    })();

    return () => {
      removeListener?.();
    };
  }, []);

  const value = useMemo(
    () => ({ pushHandler, popHandler }),
    [pushHandler, popHandler],
  );

  return (
    <BackNavigationContext.Provider value={value}>
      {children}
    </BackNavigationContext.Provider>
  );
};

/** Register a screen-level back action (job form, job detail, modal, etc.) */
export const useBackHandler = (
  id: string,
  handler: BackHandler | null,
  enabled = true,
) => {
  const ctx = useContext(BackNavigationContext);

  useEffect(() => {
    if (!ctx || !enabled || !handler) return;
    ctx.pushHandler(id, handler);
    return () => ctx.popHandler(id);
  }, [ctx, id, handler, enabled]);
};

export const exitNativeApp = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  await App.exitApp();
};
