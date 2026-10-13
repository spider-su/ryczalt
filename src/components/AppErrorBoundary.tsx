import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Last-resort render recovery; local document read failures use LocalDataRecoveryScreen. */
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View accessibilityRole="alert" style={styles.container}>
        <Text style={styles.title}>Wystąpił nieoczekiwany błąd</Text>
        <Text style={styles.message}>Spróbuj ponownie. Jeśli problem się powtarza, uruchom aplikację ponownie. Twoje zapisane dane nie zostały usunięte.</Text>
        <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
          <Text style={styles.buttonText}>Spróbuj ponownie</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F7FA' },
  title: { fontSize: 21, fontWeight: '700', color: '#172033', textAlign: 'center' },
  message: { fontSize: 15, color: '#526178', textAlign: 'center', marginTop: 12, marginBottom: 24 },
  button: { minHeight: 44, justifyContent: 'center', backgroundColor: '#172033', borderRadius: 8, paddingHorizontal: 24 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }
});
