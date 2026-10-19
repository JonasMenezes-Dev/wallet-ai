import { View, type ReactNode } from "react-native";

type Props = {
  routeName: "index" | "transactions" | "accounts" | "goals" | "settings";
  children: ReactNode;
};

/**
 * Compatibilidade temporária com imports antigos.
 *
 * A navegação entre abas é feita exclusivamente pela barra inferior.
 * Este wrapper não captura gestos horizontais nem altera a rota.
 */
export function SwipeableTabScreen({ children }: Props) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
