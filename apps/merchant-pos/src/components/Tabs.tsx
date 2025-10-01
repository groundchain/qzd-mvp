import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

export type TabsOrientation = 'horizontal' | 'vertical';

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
  id?: string;
  children: ReactNode;
}

export type TabListProps = React.HTMLAttributes<HTMLDivElement>;

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
}

export type TabPanelsProps = React.HTMLAttributes<HTMLDivElement>;

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

type TabRecord = {
  ref: MutableRefObject<HTMLButtonElement | null>;
  disabled: boolean;
};

type TabsContextValue = {
  baseId: string;
  orientation: TabsOrientation;
  activeValue: string | undefined;
  registerTab: (value: string, ref: MutableRefObject<HTMLButtonElement | null>, disabled: boolean) => () => void;
  setTabDisabled: (value: string, disabled: boolean) => void;
  setActiveValue: (value: string, options?: { focus?: boolean }) => void;
  focusTab: (value: string) => void;
  getEnabledValues: () => string[];
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within <Tabs>`);
  }
  return context;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '-');
}

type TabsComponent = ((props: TabsProps) => JSX.Element) & {
  List: ReturnType<typeof createTabListComponent>;
  Tab: ReturnType<typeof createTabComponent>;
  Panels: ReturnType<typeof createTabPanelsComponent>;
  Panel: ReturnType<typeof createTabPanelComponent>;
};

function createTabListComponent() {
  return forwardRef<HTMLDivElement, PropsWithChildren<TabListProps>>(function TabList(
    { children, onKeyDown, ...rest },
    forwardedRef,
  ) {
    const { getEnabledValues, setActiveValue, activeValue, orientation } = useTabsContext('Tabs.List');

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        const enabledValues = getEnabledValues();
        if (enabledValues.length === 0) {
          onKeyDown?.(event);
          return;
        }

        const isHorizontal = orientation === 'horizontal';
        const isVertical = orientation === 'vertical';
        const currentValue = (event.target as HTMLElement | null)?.getAttribute('data-tab-value');
        let currentIndex = enabledValues.indexOf(currentValue ?? '');
        if (currentIndex === -1) {
          currentIndex = enabledValues.indexOf(activeValue ?? '');
        }
        if (currentIndex === -1) {
          currentIndex = 0;
        }

        let handled = false;
        const move = (nextIndex: number) => {
          const clampedIndex = (nextIndex + enabledValues.length) % enabledValues.length;
          const nextValue = enabledValues[clampedIndex];
          setActiveValue(nextValue, { focus: true });
        };

        switch (event.key) {
          case 'ArrowRight':
            if (isHorizontal) {
              move(currentIndex + 1);
              handled = true;
            }
            break;
          case 'ArrowLeft':
            if (isHorizontal) {
              move(currentIndex - 1);
              handled = true;
            }
            break;
          case 'ArrowDown':
            if (isVertical) {
              move(currentIndex + 1);
              handled = true;
            }
            break;
          case 'ArrowUp':
            if (isVertical) {
              move(currentIndex - 1);
              handled = true;
            }
            break;
          case 'Home':
            setActiveValue(enabledValues[0], { focus: true });
            handled = true;
            break;
          case 'End':
            setActiveValue(enabledValues[enabledValues.length - 1], { focus: true });
            handled = true;
            break;
          default:
            break;
        }

        if (handled) {
          event.preventDefault();
        }

        onKeyDown?.(event);
      },
      [activeValue, getEnabledValues, onKeyDown, orientation, setActiveValue],
    );

    return (
      <div
        {...rest}
        ref={forwardedRef}
        role="tablist"
        aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  });
}

function createTabComponent() {
  return forwardRef<HTMLButtonElement, TabProps>(function Tab(
    { value, disabled, children, onClick, onKeyDown, ...rest },
    forwardedRef,
  ) {
    const { baseId, activeValue, setActiveValue, registerTab, setTabDisabled } = useTabsContext('Tabs.Tab');
    const innerRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
      return registerTab(value, innerRef, Boolean(disabled));
    }, [disabled, registerTab, value]);

    useEffect(() => {
      setTabDisabled(value, Boolean(disabled));
    }, [disabled, setTabDisabled, value]);

    const handleRef = useCallback(
      (node: HTMLButtonElement | null) => {
        innerRef.current = node;
        if (!forwardedRef) {
          return;
        }
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const tabId = `${baseId}-tab-${sanitizeId(value)}`;
    const panelId = `${baseId}-panel-${sanitizeId(value)}`;
    const selected = activeValue === value;
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
      setActiveValue(value, { focus: true });
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!disabled) {
          setActiveValue(value, { focus: true });
        }
      }
      onKeyDown?.(event);
    };

    return (
      <button
        {...rest}
        ref={handleRef}
        role="tab"
        type="button"
        id={tabId}
        data-tab-value={value}
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </button>
    );
  });
}

function createTabPanelsComponent() {
  return forwardRef<HTMLDivElement, PropsWithChildren<TabPanelsProps>>(function TabPanels(
    { children, ...rest },
    forwardedRef,
  ) {
    return (
      <div {...rest} ref={forwardedRef}>
        {children}
      </div>
    );
  });
}

function createTabPanelComponent() {
  return forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
    { value, children, hidden: hiddenProp, ...rest },
    forwardedRef,
  ) {
    const { baseId, activeValue } = useTabsContext('Tabs.Panel');
    const isSelected = activeValue === value;
    const panelId = `${baseId}-panel-${sanitizeId(value)}`;
    const tabId = `${baseId}-tab-${sanitizeId(value)}`;

    return (
      <div
        {...rest}
        ref={forwardedRef}
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId}
        hidden={hiddenProp ?? !isSelected}
        tabIndex={0}
      >
        {children}
      </div>
    );
  });
}

const TabList = createTabListComponent();
const Tab = createTabComponent();
const TabPanels = createTabPanelsComponent();
const TabPanel = createTabPanelComponent();

export const Tabs: TabsComponent = Object.assign(function TabsRoot({
  defaultValue,
  value: controlledValue,
  onValueChange,
  orientation = 'horizontal',
  id,
  children,
}: TabsProps) {
  const reactId = useId();
  const baseId = useMemo(() => id ?? `tabs-${sanitizeId(reactId)}`, [id, reactId]);
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | undefined>(defaultValue);
  const activeValue = isControlled ? controlledValue : uncontrolledValue;
  const tabMap = useRef(new Map<string, TabRecord>());
  const [order, setOrder] = useState<string[]>([]);
  const valueRef = useRef<string | undefined>(activeValue);

  useEffect(() => {
    valueRef.current = activeValue;
  }, [activeValue]);

  const focusTab = useCallback((value: string) => {
    const record = tabMap.current.get(value);
    if (record?.ref.current) {
      record.ref.current.focus();
    }
  }, []);

  const getEnabledValues = useCallback(() => {
    return order.filter((key) => {
      const record = tabMap.current.get(key);
      return record != null && !record.disabled;
    });
  }, [order]);

  const setActiveValue = useCallback(
    (nextValue: string, options?: { focus?: boolean }) => {
      const record = tabMap.current.get(nextValue);
      if (!record || record.disabled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      if (options?.focus) {
        focusTab(nextValue);
      }
      if (nextValue !== valueRef.current) {
        onValueChange?.(nextValue);
      }
    },
    [focusTab, isControlled, onValueChange],
  );

  const registerTab = useCallback(
    (value: string, ref: MutableRefObject<HTMLButtonElement | null>, disabled: boolean) => {
      tabMap.current.set(value, { ref, disabled });
      setOrder((previous) => (previous.includes(value) ? previous : [...previous, value]));

      return () => {
        tabMap.current.delete(value);
        setOrder((previous) => {
          const nextOrder = previous.filter((item) => item !== value);
          if (valueRef.current === value) {
            const fallback = nextOrder.find((item) => {
              const record = tabMap.current.get(item);
              return record != null && !record.disabled;
            });
            if (!isControlled) {
              setUncontrolledValue(fallback);
            }
            if (fallback && fallback !== valueRef.current) {
              onValueChange?.(fallback);
              focusTab(fallback);
            }
          }
          return nextOrder;
        });
      };
    },
    [focusTab, isControlled, onValueChange],
  );

  const setTabDisabled = useCallback((value: string, disabled: boolean) => {
    const record = tabMap.current.get(value);
    if (!record) {
      return;
    }
    record.disabled = disabled;
    if (disabled && valueRef.current === value) {
      const enabledValues = getEnabledValues();
      const fallback = enabledValues[0];
      if (fallback && fallback !== value) {
        setActiveValue(fallback, { focus: true });
      }
    }
  }, [getEnabledValues, setActiveValue]);

  useEffect(() => {
    if (isControlled) {
      return;
    }

    const enabledValues = getEnabledValues();
    if (enabledValues.length === 0) {
      return;
    }

    const currentRecord = activeValue ? tabMap.current.get(activeValue) : undefined;
    if (activeValue === undefined || !currentRecord || currentRecord.disabled) {
      const fallback = enabledValues[0];
      if (fallback && fallback !== valueRef.current) {
        setUncontrolledValue(fallback);
        onValueChange?.(fallback);
      }
    }
  }, [activeValue, getEnabledValues, isControlled, onValueChange]);

  const contextValue = useMemo<TabsContextValue>(
    () => ({
      baseId,
      orientation,
      activeValue,
      registerTab,
      setActiveValue,
      setTabDisabled,
      focusTab,
      getEnabledValues,
    }),
    [activeValue, baseId, focusTab, getEnabledValues, orientation, registerTab, setActiveValue, setTabDisabled],
  );

  return <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>;
},
{
  List: TabList,
  Tab,
  Panels: TabPanels,
  Panel: TabPanel,
});

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;

export default Tabs;
