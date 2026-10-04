import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';


interface Props {
  children: ReactNode;
  onBack: () => void;
  /** Where the error is recorded; injectable for tests. */
  onError?: (error: Error) => void;
}

/** Catches render errors of one screen; the stack goes to diag_log, never to the user. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Algo deu errado nesta tela</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={this.props.onBack} style={styles.btn}>
            <Text>Voltar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => this.setState({ error: null })}
            style={styles.btn}
          >
            <Text>Tentar de novo</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { padding: 12, borderWidth: 1, borderColor: '#999', borderRadius: 8 },
});
