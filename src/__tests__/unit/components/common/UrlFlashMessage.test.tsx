import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    searchParams: new URLSearchParams(),
    pathname: '/es',
    routerReplace: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    translations: {
      authError: 'Sign-in failed.',
      paymentError: "Payment didn't go through.",
      upgraded: 'Welcome to Premium!',
    } as Record<string, string>,
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.routerReplace }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => mocks.translations[key] ?? key,
}))

vi.mock('sonner', () => ({
  toast: {
    error: (m: string) => mocks.toastError(m),
    success: (m: string) => mocks.toastSuccess(m),
  },
}))

import { UrlFlashMessage } from '@/components/common/UrlFlashMessage'

describe('<UrlFlashMessage>', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams()
    mocks.pathname = '/es'
    mocks.routerReplace.mockClear()
    mocks.toastError.mockClear()
    mocks.toastSuccess.mockClear()
  })

  it('renders nothing (no DOM output)', () => {
    const { container } = render(<UrlFlashMessage />)
    expect(container.firstChild).toBeNull()
  })

  it('does NOT fire any toast when no flag params are present', () => {
    render(<UrlFlashMessage />)
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.routerReplace).not.toHaveBeenCalled()
  })

  it('fires authError toast and strips the flag from the URL when ?auth_error=1', () => {
    mocks.searchParams = new URLSearchParams('auth_error=1')
    render(<UrlFlashMessage />)
    expect(mocks.toastError).toHaveBeenCalledWith('Sign-in failed.')
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.routerReplace).toHaveBeenCalledWith('/es', { scroll: false })
  })

  it('fires paymentError toast when ?payment_error=1', () => {
    mocks.searchParams = new URLSearchParams('payment_error=1')
    render(<UrlFlashMessage />)
    expect(mocks.toastError).toHaveBeenCalledWith("Payment didn't go through.")
    expect(mocks.routerReplace).toHaveBeenCalledWith('/es', { scroll: false })
  })

  it('fires upgraded SUCCESS toast when ?upgraded=true', () => {
    mocks.searchParams = new URLSearchParams('upgraded=true')
    render(<UrlFlashMessage />)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Welcome to Premium!')
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.routerReplace).toHaveBeenCalledWith('/es', { scroll: false })
  })

  it('preserves unrelated query params when stripping the flag', () => {
    mocks.searchParams = new URLSearchParams('upgraded=true&ref=ABC&utm_source=newsletter')
    render(<UrlFlashMessage />)
    expect(mocks.routerReplace).toHaveBeenCalledTimes(1)
    const [url] = mocks.routerReplace.mock.calls[0]
    // The replacement URL keeps ref + utm_source but removes the upgrade flag.
    expect(url).toContain('ref=ABC')
    expect(url).toContain('utm_source=newsletter')
    expect(url).not.toContain('upgraded')
  })

  it('prioritizes auth_error over payment_error when both are somehow present', () => {
    mocks.searchParams = new URLSearchParams('auth_error=1&payment_error=1')
    render(<UrlFlashMessage />)
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('Sign-in failed.')
  })

  it('respects the current pathname when rebuilding the cleaned URL', () => {
    mocks.pathname = '/ru/profile/%23ABC'
    mocks.searchParams = new URLSearchParams('upgraded=true')
    render(<UrlFlashMessage />)
    expect(mocks.routerReplace).toHaveBeenCalledWith('/ru/profile/%23ABC', { scroll: false })
  })
})
