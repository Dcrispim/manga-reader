// Native worklets are not available under jest; use reanimated's own mock.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

import { Text } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { act, create } from 'react-test-renderer';

import { ZoomableList } from '../ZoomableList';

describe('ZoomableList', () => {
  it('renders its children and accepts pinch and double-tap gestures', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ZoomableList>
          <Text>page</Text>
        </ZoomableList>,
      );
    });
    expect(tree.root.findByType(Text).props.children).toBe('page');
    expect(() => {
      act(() => {
        fireGestureHandler(getByGestureTestId('pinch'), [
          { scale: 1 },
          { scale: 2 },
          { scale: 2.5 },
        ]);
        fireGestureHandler(getByGestureTestId('doubleTap'), [{ numberOfPointers: 1 }]);
      });
    }).not.toThrow();
  });
});
