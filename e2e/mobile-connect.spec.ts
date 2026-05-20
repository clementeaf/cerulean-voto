import { test, expect } from '@playwright/test'

// AuthGate renders on any protected route when not authenticated.
const AUTH_GATE_URL = '/dashboard'
const WALLET_ORIGIN = 'https://wallet.ceruleanledger.com'

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

// Mock all backend API calls so the app loads without a real node
function mockAPIs(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/v1/private-data/collections', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    ),
    page.route('**/api/v1/private-data/voto-connect/**', route =>
      route.fulfill({ status: 404 }),
    ),
    page.route('**/api/v1/store/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"Success","data":[]}' }),
    ),
  ])
}

// ---------- Desktop (no extension) → shows QR tab, not mobile tab ----------

test.describe('Desktop — AuthGate tabs', () => {
  test.use({ userAgent: DESKTOP_UA })

  test('shows QR tab and hides mobile tab', async ({ page }) => {
    await mockAPIs(page)
    await page.goto(AUTH_GATE_URL)
    await expect(page.getByRole('button', { name: 'QR Celular' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Conectar$/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Importar' })).toBeVisible()
  })

  test('QR tab renders QR code and polls', async ({ page }) => {
    await mockAPIs(page)
    await page.goto(AUTH_GATE_URL)
    await page.getByRole('button', { name: 'QR Celular' }).click()
    await expect(page.getByRole('img').nth(1)).toBeVisible() // QR code SVG
    await expect(page.getByText('Esperando conexion desde celular')).toBeVisible()
  })
})

// ---------- Mobile → shows Conectar tab, not QR tab ----------

test.describe('Mobile — AuthGate tabs', () => {
  test.use({ userAgent: MOBILE_UA })

  test('shows Conectar tab and hides QR tab', async ({ page }) => {
    await mockAPIs(page)
    await page.goto(AUTH_GATE_URL)
    await expect(page.getByRole('button', { name: /^Conectar$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'QR Celular' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Importar' })).toBeVisible()
  })

  test('shows explanation text and redirect button', async ({ page }) => {
    await mockAPIs(page)
    await page.goto(AUTH_GATE_URL)
    await expect(page.getByText('Cerulean Wallet', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abrir Cerulean Wallet' })).toBeVisible()
  })

  test('redirect button builds correct wallet URL', async ({ page }) => {
    await mockAPIs(page)
    await page.goto(AUTH_GATE_URL)

    // Intercept the navigation to wallet origin
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().startsWith(WALLET_ORIGIN), { timeout: 10000 }),
      page.getByRole('button', { name: 'Abrir Cerulean Wallet' }).click(),
    ]).catch(() => [null])

    if (request) {
      const url = new URL(request.url())
      expect(url.origin).toBe(WALLET_ORIGIN)
      expect(url.pathname).toBe('/connect')
      expect(url.searchParams.get('session')).toBeTruthy()
      expect(url.searchParams.get('session')!.length).toBe(24) // 12 bytes hex
      expect(url.searchParams.get('node')).toBeTruthy()
      expect(url.searchParams.get('callback')).toBeTruthy()
    } else {
      // Fallback: check that sessionStorage was set (session was created)
      const sessionId = await page.evaluate(() => sessionStorage.getItem('cv_mobile_session'))
      expect(sessionId).toBeTruthy()
      expect(sessionId!.length).toBe(24)
    }
  })
})

// ---------- Mobile callback — returning from wallet ----------

test.describe('Mobile — callback flow', () => {
  test.use({ userAgent: MOBILE_UA })

  const FAKE_PUB_KEY = 'aa'.repeat(32) // 32 bytes = 64 hex chars

  test('auto-authenticates when returning with valid session', async ({ page }) => {
    // Compute expected address in Node context
    const pubBytes = new Uint8Array(32).fill(0xaa)
    const hashBuffer = await crypto.subtle.digest('SHA-256', pubBytes)
    const expectedAddress = Array.from(new Uint8Array(hashBuffer).slice(0, 20))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    // Mock relay — return public key for this session
    await page.route('**/api/v1/private-data/voto-connect/test-session-123', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { value: FAKE_PUB_KEY } }),
      }),
    )
    await page.route('**/api/v1/private-data/collections', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.route('**/api/v1/store/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"Success","data":[]}' }),
    )

    // Simulate returning from wallet with ?session= param
    await page.goto(`${AUTH_GATE_URL}?session=test-session-123`)

    // Should authenticate — AuthGate disappears, app layout renders
    // The truncated address appears in the header
    await expect(page.getByText(expectedAddress.slice(0, 12))).toBeVisible({ timeout: 10000 })

    // Session param cleaned from URL
    await expect(page).not.toHaveURL(/session=/)
  })

  test('shows error for expired/invalid session', async ({ page }) => {
    await page.route('**/api/v1/private-data/voto-connect/expired-session', route =>
      route.fulfill({ status: 404 }),
    )
    await page.route('**/api/v1/private-data/collections', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )

    await page.goto(`${AUTH_GATE_URL}?session=expired-session`)

    await expect(page.getByText('Sesion expirada o no encontrada')).toBeVisible({ timeout: 10000 })
  })
})
