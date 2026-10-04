import type { ColorOption } from "@/context/AppContext";

/**
 * Sorts product colors according to the order defined in settings.globalColors.
 * Any colors not present in globalColors are preserved at the end.
 */
export function sortColorsByGlobal(
  colors: ColorOption[] = [],
  globalColors: ColorOption[] = []
): ColorOption[] {
  if (!Array.isArray(colors) || colors.length <= 1) return colors ?? [];
  if (!Array.isArray(globalColors) || globalColors.length === 0) return colors;

  const colorOrder = new Map<string, number>();
  globalColors.forEach((color, index) => {
    if (color && typeof color.name === "string") {
      colorOrder.set(color.name.trim().toLowerCase(), index);
    }
  });

  return [...colors].sort((a, b) => {
    const aKey = a && typeof a.name === "string" ? a.name.trim().toLowerCase() : "";
    const bKey = b && typeof b.name === "string" ? b.name.trim().toLowerCase() : "";
    const aIndex = colorOrder.has(aKey) ? (colorOrder.get(aKey) as number) : Number.MAX_SAFE_INTEGER;
    const bIndex = colorOrder.has(bKey) ? (colorOrder.get(bKey) as number) : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}
