import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { systemTicketViews } from '../data/mockViews';
import type { TicketView } from '../domain/types';

const STORAGE_KEY = 'legend.support.customViews.v1';

interface ViewStore {
  systemViews: TicketView[];
  customViews: TicketView[];
  views: TicketView[];
  getView: (id: string) => TicketView | undefined;
  createView: (view: Omit<TicketView, 'id' | 'type'>) => TicketView;
  updateView: (id: string, patch: Omit<TicketView, 'id' | 'type'>) => void;
  duplicateView: (id: string) => TicketView | undefined;
  deleteView: (id: string) => void;
}

const ViewContext = createContext<ViewStore | null>(null);

function readCustomViews(): TicketView[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as TicketView[]) : [];
  } catch {
    return [];
  }
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'custom-view';
}

function uniqueId(base: string, existingIds: string[]): string {
  let id = base;
  let index = 2;

  while (existingIds.includes(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  return id;
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [customViews, setCustomViews] = useState<TicketView[]>(readCustomViews);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customViews));
  }, [customViews]);

  const views = useMemo(() => [...systemTicketViews, ...customViews], [customViews]);

  const createView = useCallback(
    (view: Omit<TicketView, 'id' | 'type'>) => {
      const created: TicketView = {
        ...view,
        id: uniqueId(`custom-${slugify(view.name)}`, views.map((item) => item.id)),
        type: 'custom',
      };
      setCustomViews((current) => [...current, created]);
      return created;
    },
    [views],
  );

  const updateView = useCallback((id: string, patch: Omit<TicketView, 'id' | 'type'>) => {
    setCustomViews((current) =>
      current.map((view) => (view.id === id ? { ...view, ...patch, id, type: 'custom' } : view)),
    );
  }, []);

  const duplicateView = useCallback(
    (id: string) => {
      const source = views.find((view) => view.id === id);
      if (!source) return undefined;

      const duplicated: TicketView = {
        ...source,
        id: uniqueId(`custom-${slugify(`${source.name}-copy`)}`, views.map((view) => view.id)),
        name: `${source.name} copy`,
        type: 'custom',
      };
      setCustomViews((current) => [...current, duplicated]);
      return duplicated;
    },
    [views],
  );

  const deleteView = useCallback((id: string) => {
    setCustomViews((current) => current.filter((view) => view.id !== id));
  }, []);

  const value = useMemo<ViewStore>(
    () => ({
      systemViews: systemTicketViews,
      customViews,
      views,
      getView: (id) => views.find((view) => view.id === id),
      createView,
      updateView,
      duplicateView,
      deleteView,
    }),
    [createView, customViews, deleteView, duplicateView, updateView, views],
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTicketViews() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useTicketViews must be used within ViewProvider');
  }
  return context;
}
