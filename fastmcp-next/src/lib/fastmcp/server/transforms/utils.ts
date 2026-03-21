/**
 * Transform utilities — shared helpers for cloning components with overrides.
 */

/**
 * Clone a component with property overrides.
 *
 * Components are read-only, so we create a new object with the same
 * prototype and override specific properties.
 */
export function cloneComponent<T>(
  component: T,
  overrides: Record<string, unknown>
): T {
  const clone = Object.create(Object.getPrototypeOf(component));
  Object.assign(clone, component);
  for (const [key, value] of Object.entries(overrides)) {
    clone[key] = value;
  }
  // Deep-clone meta to avoid cross-mutation (meta only contains serializable data)
  const meta = (component as Record<string, unknown>).meta;
  if (meta && typeof meta === "object") {
    clone.meta = structuredClone(meta);
  }
  return clone as T;
}
