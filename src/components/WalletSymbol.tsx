import { SymbolView } from "expo-symbols";
import { Text, type ColorValue } from "react-native";

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
  | "notification"
  | "plus"
  | "income"
  | "expense"
  | "transfer"
  | "food"
  | "shopping"
  | "bank"
  | "card"
  | "goal"
  | "more";

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
  notification: { ios: "bell.badge.fill", android: "notifications_active", web: "notifications_active" },
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
} as const;

const fallbacks: Record<WalletIconName, string> = {
  home: "⌂",
  transactions: "↔",
  accounts: "▣",
  goals: "◎",
  settings: "⚙",
  alerts: "♧",
  budget: "▥",
  recurring: "↻",
  reports: "▤",
  notification: "♧",
  plus: "+",
  income: "↙",
  expense: "↗",
  transfer: "↔",
  food: "•",
  shopping: "▣",
  bank: "▤",
  card: "▰",
  goal: "⚑",
  more: "•••",
};

type WalletSymbolProps = {
  name: WalletIconName;
  color: ColorValue;
  size?: number;
};

export function WalletSymbol({ name, color, size = 22 }: WalletSymbolProps) {
  return (
    <SymbolView
      name={symbols[name]}
      size={size}
      tintColor={color}
      fallback={
        <Text style={{ color, fontSize: size, lineHeight: size + 2 }}>
          {fallbacks[name]}
        </Text>
      }
    />
  );
}
