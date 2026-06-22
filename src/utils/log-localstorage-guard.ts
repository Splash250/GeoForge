type RestoreGlobals = () => void;

let restoreGlobals: RestoreGlobals | undefined;

const hasNodeRuntime = typeof process !== 'undefined' && Boolean(process.versions?.node);

const restoreProperty = (
  target: object,
  key: 'localStorage' | 'window',
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
};

const makePropertyUnavailable = (target: object, key: 'localStorage' | 'window') => {
  try {
    if (Reflect.deleteProperty(target, key)) {
      return;
    }
  } catch {
    // Ignore delete failures and fall through to shadow the property with undefined.
  }

  Object.defineProperty(target, key, {
    configurable: true,
    value: undefined,
  });
};

if (hasNodeRuntime && typeof window === 'undefined' && 'localStorage' in globalThis) {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  makePropertyUnavailable(globalThis, 'localStorage');

  restoreGlobals = () => {
    restoreProperty(globalThis, 'localStorage', localStorageDescriptor);
  };
} else if (hasNodeRuntime && typeof window !== 'undefined') {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

  makePropertyUnavailable(globalThis, 'window');

  restoreGlobals = () => {
    restoreProperty(globalThis, 'window', windowDescriptor);
  };
}

export const restoreLocalStorageAfterLoglevelImport = () => {
  try {
    restoreGlobals?.();
  } finally {
    restoreGlobals = undefined;
  }
};
