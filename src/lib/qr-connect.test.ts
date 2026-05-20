import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock wallet module
vi.mock('./wallet', () => ({
  CERULEAN_WALLET_URL: 'https://wallet.ceruleanledger.com',
}))

import {
  isMobileBrowser,
  getPendingMobileSession,
  cleanupMobileSession,
} from './qr-connect'

describe('mobile redirect flow', () => {
  const originalNavigator = navigator.userAgent

  beforeEach(() => {
    sessionStorage.clear()
    // Reset URL to clean state
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    // Restore userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  describe('isMobileBrowser', () => {
    it('returns true for iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        writable: true,
        configurable: true,
      })
      expect(isMobileBrowser()).toBe(true)
    })

    it('returns true for Android', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        writable: true,
        configurable: true,
      })
      expect(isMobileBrowser()).toBe(true)
    })

    it('returns false for desktop Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        writable: true,
        configurable: true,
      })
      expect(isMobileBrowser()).toBe(false)
    })
  })

  describe('getPendingMobileSession', () => {
    it('returns session from URL params', () => {
      window.history.replaceState({}, '', '/?session=abc123')
      expect(getPendingMobileSession()).toBe('abc123')
    })

    it('returns session from sessionStorage', () => {
      sessionStorage.setItem('cv_mobile_session', 'def456')
      expect(getPendingMobileSession()).toBe('def456')
    })

    it('prefers URL param over sessionStorage', () => {
      window.history.replaceState({}, '', '/?session=from-url')
      sessionStorage.setItem('cv_mobile_session', 'from-storage')
      expect(getPendingMobileSession()).toBe('from-url')
    })

    it('returns null when no session pending', () => {
      expect(getPendingMobileSession()).toBeNull()
    })
  })

  describe('cleanupMobileSession', () => {
    it('removes session from sessionStorage', () => {
      sessionStorage.setItem('cv_mobile_session', 'abc')
      cleanupMobileSession()
      expect(sessionStorage.getItem('cv_mobile_session')).toBeNull()
    })

    it('removes session param from URL', () => {
      window.history.replaceState({}, '', '/?session=abc&other=1')
      cleanupMobileSession()
      expect(window.location.search).toBe('?other=1')
    })

    it('cleans URL completely when session is only param', () => {
      window.history.replaceState({}, '', '/?session=abc')
      cleanupMobileSession()
      expect(window.location.search).toBe('')
    })
  })
})
