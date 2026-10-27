import { createContext, useContext, type ReactNode } from "react";
export type WeightUnit = "kg" | "lb";
export const UnitContext = createContext<WeightUnit>("kg");
export const useUnits = () => useContext(UnitContext);
export const displayWeight = (kg: number, unit: WeightUnit) =>
  unit === "kg" ? kg : Math.round(kg * 2.2046226218 * 100) / 100;
export const kilograms = (value: number, unit: WeightUnit) =>
  unit === "kg"
    ? value
    : Math.round((value / 2.2046226218) * 1_000_000) / 1_000_000;
export function UnitProvider({
  unit,
  children,
}: {
  unit: WeightUnit;
  children: ReactNode;
}) {
  return <UnitContext.Provider value={unit}>{children}</UnitContext.Provider>;
}
