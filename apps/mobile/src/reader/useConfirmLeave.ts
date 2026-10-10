import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

export function useConfirmLeave() {
  const navigation = useNavigation();
  const released = useRef(false);

  usePreventRemove(true, ({ data }) => {
    if (released.current) return navigation.dispatch(data.action);
    Alert.alert('Sair do capítulo?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  return useCallback((go: () => void) => {
    released.current = true;
    go();
  }, []);
}
