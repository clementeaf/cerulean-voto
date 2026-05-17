// Node 22+ exposes a broken built-in localStorage that shadows happy-dom/jsdom.
// Replace it with a proper in-memory implementation for tests.
import { beforeEach } from 'vitest'

const store = new Map<string, string>()

const localStorageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  get length() { return store.size },
  key: (index: number) => [...store.keys()][index] ?? null,
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => {
  store.clear()
})
