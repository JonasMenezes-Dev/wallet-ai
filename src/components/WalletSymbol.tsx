import { SymbolView } from "expo-symbols";
import { Image } from "expo-image";
import { View, type ColorValue } from "react-native";

export type WalletIconName =
  | "home"
  | "transactions"
  | "accounts"
  | "goals"
  | "settings"
  | "alerts"
  | "budget"
  | "recurring"
  | "reports"
  | "plus"
  | "income"
  | "expense"
  | "transfer"
  | "food"
  | "shopping"
  | "bank"
  | "card"
  | "goal"
  | "more"
  | "success"
  | "error"
  | "close"
  | "search"
  | "filter"
  | "receipt"
  | "chevron"
  | "insight";

const symbols = {
  home: { ios: "house.fill", android: "home", web: "home" },
  transactions: { ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" },
  accounts: { ios: "wallet.pass.fill", android: "account_balance_wallet", web: "account_balance_wallet" },
  goals: { ios: "target", android: "track_changes", web: "track_changes" },
  settings: { ios: "gearshape.fill", android: "settings", web: "settings" },
  alerts: { ios: "bell.fill", android: "notifications", web: "notifications" },
  budget: { ios: "chart.bar.fill", android: "bar_chart", web: "bar_chart" },
  recurring: { ios: "calendar", android: "calendar_month", web: "calendar_month" },
  reports: { ios: "chart.pie.fill", android: "pie_chart", web: "pie_chart" },
  plus: { ios: "plus", android: "add", web: "add" },
  income: { ios: "arrow.down.left", android: "south_west", web: "south_west" },
  expense: { ios: "arrow.up.right", android: "north_east", web: "north_east" },
  transfer: { ios: "arrow.left.arrow.right", android: "swap_horiz", web: "swap_horiz" },
  food: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
  shopping: { ios: "cart.fill", android: "shopping_cart", web: "shopping_cart" },
  bank: { ios: "building.columns.fill", android: "account_balance", web: "account_balance" },
  card: { ios: "creditcard.fill", android: "credit_card", web: "credit_card" },
  goal: { ios: "flag.fill", android: "flag", web: "flag" },
  more: { ios: "ellipsis", android: "more_horiz", web: "more_horiz" },
  success: { ios: "checkmark.circle", android: "check_circle", web: "check_circle" },
  error: { ios: "exclamationmark.circle", android: "error", web: "error" },
  close: { ios: "xmark", android: "close", web: "close" },
  search: { ios: "magnifyingglass", android: "search", web: "search" },
  filter: { ios: "line.3.horizontal.decrease", android: "filter_list", web: "filter_list" },
  receipt: { ios: "creditcard", android: "receipt_long", web: "receipt_long" },
  chevron: { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  insight: { ios: "sparkles", android: "auto_awesome", web: "auto_awesome" },
} as const;

const approvedIcons = {
  home: require("../../assets/premium/home.svg"),
  transactions: require("../../assets/premium/transactions.svg"),
  accounts: require("../../assets/premium/accounts.svg"),
  goals: require("../../assets/premium/goals.svg"),
  settings: require("../../assets/premium/settings.svg"),
  income: require("../../assets/premium/income.svg"),
  expense: require("../../assets/premium/expense.svg"),
  insight: require("../../assets/premium/insight.svg"),
  search: require("../../assets/premium/search.svg"),
  filter: require("../../assets/premium/filter.svg"),
  success: require("../../assets/premium/success.svg"),
  transfer: require("../../assets/premium/transfer.svg"),
  recurring: require("../../assets/premium/recurring.svg"),
  receipt: require("../../assets/premium/receipt.svg"),
};

type WalletSymbolProps = {
  name: WalletIconName;
  color: ColorValue;
  size?: number;
};

export function WalletSymbol({ name, color, size = 22 }: WalletSymbolProps) {
  if (name in approvedIcons && typeof color === "string") {
    return <Image source={approvedIcons[name as keyof typeof approvedIcons]} tintColor={color} contentFit="contain" accessible={false} style={{ width: size, height: size }} />;
  }
  return (
    <SymbolView
      accessible={false}
      name={symbols[name]}
      size={size}
      tintColor={color}
      fallback={<View style={{ width: size, height: size }} />}
    />
  );
}
