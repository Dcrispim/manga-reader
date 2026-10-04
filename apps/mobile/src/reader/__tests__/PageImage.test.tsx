import { Image } from 'expo-image';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { PageImage } from '../PageImage';

function mount(props: Partial<Parameters<typeof PageImage>[0]> = {}) {
  let tree!: ReturnType<typeof create>;
  const el = (p: typeof props) => <PageImage uri="http://srv/a.jpg" {...p} />;
  act(() => { tree = create(el(props)); });
  return { tree, update: (p: typeof props) => act(() => tree.update(el(p))) };
}

const texts = (t: ReturnType<typeof create>) => t.root.findAllByType(Text).map((n) => n.props.children);

describe('PageImage', () => {
  it('shows the image first and the placeholder after onError', () => {
    const { tree } = mount();
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
    act(() => tree.root.findByType(Image).props.onError());
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(texts(tree)).toEqual(['Toque para tentar de novo']);
  });

  it('retries when the placeholder is tapped', () => {
    const { tree } = mount();
    act(() => tree.root.findByType(Image).props.onError());
    act(() => tree.root.findByProps({ accessibilityRole: 'button' }).props.onPress());
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
  });

  it('retries on its own when the retry token changes', () => {
    const { tree, update } = mount({ retryToken: 0 });
    act(() => tree.root.findByType(Image).props.onError());
    update({ retryToken: 1 });
    expect(tree.root.findAllByType(Image)).toHaveLength(1);
  });

  it('uses the last known aspect (default 0.7) for the placeholder height', () => {
    const { tree } = mount({ fallbackAspect: 0.5 });
    act(() => tree.root.findByType(Image).props.onError());
    const style = tree.root.findByProps({ accessibilityRole: 'button' }).props.style;
    const flat = Object.assign({}, ...[style].flat());
    expect(flat.height).toBeCloseTo(flat.width / 0.5);
  });
});
