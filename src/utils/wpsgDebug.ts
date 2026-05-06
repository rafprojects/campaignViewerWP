export type WpsgDebugProps = Record<string, string>;

export function getWpsgDebugProps(
  component: string,
  slot?: string,
  enabled: boolean = import.meta.env.DEV,
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
  enabled: boolean = import.meta.env.DEV,
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