import { Alert, type AlertButton } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useConfirmLeave } from '../useConfirmLeave';

const mockDispatch = jest.fn();
let mockPrevent: boolean | undefined;
let mockOnPrevented: ((o: { data: { action: unknown } }) => void) | undefined;

jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: mockDispatch }) }));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (p: boolean, cb: typeof mockOnPrevented) => {
    mockPrevent = p;
    mockOnPrevented = cb;
  },
}));

const action = { type: 'POP' };

function mount() {
  const out: { leave: ReturnType<typeof useConfirmLeave> | null } = { leave: null };
  function Probe() {
    out.leave = useConfirmLeave();
    return null;
  }
  act(() => { create(<Probe />); });
  return out;
}

describe('useConfirmLeave', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('asks before leaving and only leaves on "Sair"', () => {
    mount();
    expect(mockPrevent).toBe(true);
    mockOnPrevented!({ data: { action } });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalled();

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.text === 'Cancelar')!.onPress?.();
    expect(mockDispatch).not.toHaveBeenCalled();
    buttons.find((b) => b.text === 'Sair')!.onPress!();
    expect(mockDispatch).toHaveBeenCalledWith(action);
  });

  it('lets released navigations through without asking', () => {
    const out = mount();
    const go = jest.fn(() => mockOnPrevented!({ data: { action } }));
    out.leave!(go);
    expect(go).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(action);
  });
});
