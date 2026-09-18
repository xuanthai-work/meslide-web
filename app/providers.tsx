'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import { I18nProvider } from '@/i18n/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <Provider store={store}>{children}</Provider>
    </I18nProvider>
  );
}