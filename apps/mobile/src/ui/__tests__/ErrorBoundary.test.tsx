import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { ErrorBoundary } from '../ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('catches a child error, reports it and offers both buttons', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onError = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ErrorBoundary onBack={() => {}} onError={onError}>
          <Boom />
        </ErrorBoundary>,
      );
    });
    const texts = tree.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toEqual(['Algo deu errado nesta tela', 'Voltar', 'Tentar de novo']);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'kaboom' }));
    spy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ErrorBoundary onBack={() => {}}>
          <Text>ok</Text>
        </ErrorBoundary>,
      );
    });
    expect(tree.root.findByType(Text).props.children).toBe('ok');
  });

  it('clears the error when resetKey changes, keeping the same instance', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    function Maybe() {
      if (fail) throw new Error('kaboom');
      return <Text>ok</Text>;
    }
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ErrorBoundary onBack={() => {}} resetKey="/a">
          <Maybe />
        </ErrorBoundary>,
      );
    });
    const boundary = tree.root.findByType(ErrorBoundary).instance;
    fail = false;
    act(() => {
      tree.update(
        <ErrorBoundary onBack={() => {}} resetKey="/b">
          <Maybe />
        </ErrorBoundary>,
      );
    });
    expect(tree.root.findByType(Text).props.children).toBe('ok');
    expect(tree.root.findByType(ErrorBoundary).instance).toBe(boundary);
    spy.mockRestore();
  });
});
