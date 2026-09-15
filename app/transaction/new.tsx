import { StyleSheet, Text, View } from 'react-native';

export default function NewTransactionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nova transação</Text>
      <Text style={styles.subtitle}>
        Tela em construção.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 8,
    color: '#666',
  },
});