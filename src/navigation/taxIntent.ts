export type TaxNavigation = {
  navigate: (route: "Podatek", params?: { period: string }) => void;
};

export function navigateToTaxDetails(navigation: TaxNavigation, period?: string) {
  if (period) navigation.navigate("Podatek", { period });
  else navigation.navigate("Podatek");
}
