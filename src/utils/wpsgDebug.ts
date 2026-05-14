export type WpsgDebugProps = Record<string, string>;

export interface WpsgDebugNamedComponent {
  displayName?: string | undefined;
}

function isWpsgDebugEnabled(enabled?: boolean): boolean {
  return enabled ?? (import.meta.env.DEV || (window.__WPSG_CONFIG__?.debugComponentMarkers ?? false));
}

export function getWpsgDebugProps(
  component: string,
  slot?: string,
  enabled: boolean = isWpsgDebugEnabled(),
): WpsgDebugProps {
  if (!enabled) {
    return {};
  }

  return slot
    ? {
      'data-wpsg-component': component,
      'data-wpsg-slot': slot,
    }
    : {
      'data-wpsg-component': component,
    };
}

export function getWpsgDebugSlotAttributes<TSlotKey extends string>(
  component: string,
  slotMap: Record<TSlotKey, string>,
  enabled: boolean = isWpsgDebugEnabled(),
): Partial<Record<TSlotKey, WpsgDebugProps>> | undefined {
  if (!enabled) {
    return undefined;
  }

  return Object.fromEntries(
    (Object.entries(slotMap) as Array<[TSlotKey, string]>).map(([slotKey, slotName]) => [
      slotKey,
      getWpsgDebugProps(component, slotName, true),
    ]),
  ) as Partial<Record<TSlotKey, WpsgDebugProps>>;
}

export function setWpsgDebugDisplayName<T extends object>(
  component: T,
  name: string,
  enabled: boolean = isWpsgDebugEnabled(),
): T {
  (component as WpsgDebugNamedComponent).displayName = enabled ? name : undefined;
  return component;
}