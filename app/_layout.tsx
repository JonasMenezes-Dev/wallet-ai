import { Stack } from "expo-router";
import { useEffect } from "react";

import { getDatabase } from "../src/database/database";

export default function RootLayout() {
  useEffect(() => {
    getDatabase().catch((error) => {
      console.error("Erro ao inicializar banco de dados:", error);
    });
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
