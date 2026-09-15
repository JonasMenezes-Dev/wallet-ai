import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transações',
        }}
      />

      <Tabs.Screen
        name="goals"
        options={{
          title: 'Metas',
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Configurações',
        }}
      />
    </Tabs>
  );
}