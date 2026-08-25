export type MullionDebugProps = Record<string, string>;

export interface MullionDebugNamedComponent {
  displayName?: string | undefined;
}

function isMullionDebugEnabled(enabled?: boolean): boolean {
  return enabled ?? (import.meta.env.DEV || (window.__MULLION_CONFIG__?.debugComponentMarkers ?? false));
}

export function getMullionDebugProps(
  component: string,
  slot?: string,
  enabled: boolean = isMullionDebugEnabled(),
): MullionDebugProps {
  if (!enabled) {
    return {};
  }

  return slot
    ? {
      'data-mullion-component': component,
      'data-mullion-slot': slot,
    }
    : {
      'data-mullion-component': component,
    };
}

export function getMullionDebugSlotAttributes<TSlotKey extends string>(
  component: string,
  slotMap: Record<TSlotKey, string>,
  enabled: boolean = isMullionDebugEnabled(),
): Partial<Record<TSlotKey, MullionDebugProps>> | undefined {
  if (!enabled) {
    return undefined;
  }

  return Object.fromEntries(
    (Object.entries(slotMap) as Array<[TSlotKey, string]>).map(([slotKey, slotName]) => [
      slotKey,
      getMullionDebugProps(component, slotName, true),
    ]),
  ) as Partial<Record<TSlotKey, MullionDebugProps>>;
}

export function setMullionDebugDisplayName<T extends object>(
  component: T,
  name: string,
  enabled: boolean = isMullionDebugEnabled(),
): T {
  (component as MullionDebugNamedComponent).displayName = enabled ? name : undefined;
  return component;
}