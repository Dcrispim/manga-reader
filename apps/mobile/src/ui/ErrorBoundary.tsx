import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { colors } from './theme';


interface Props {
  children: ReactNode;
  /** A change (e.g. the route) clears a shown error, without remounting the children. */
  resetKey?: string;
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

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Algo deu errado nesta tela</Text>
        <View style={styles.row}>
          <Button variant="outline" label="Voltar" onPress={this.props.onBack} />
          <Button label="Tentar de novo" onPress={() => this.setState({ error: null })} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.background,
  },
  title: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
});
