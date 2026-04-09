import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProfile, createProfile, isPremium } from '@/lib/auth'
import type { Profile } from '@/lib/supabase/types'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const MOCK_PROFILE: Profile = {
  id: 'user-uuid-1',
  player_tag: '#YJU282PV',
  tier: 'free',
  ls_customer_id: null,
  ls_subscription_id: null,
  ls_subscription_status: null,
  last_sync: null,
  trial_ends_at: null,
  referral_code: null,
  referred_by: null,
  referral_count: 0,
  created_at: '2026-04-06T00:00:00Z',
  updated_at: '2026-04-06T00:00:00Z',
}

describe('auth utilities', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('isPremium', () => {
    it('returns true for premium tier with active status', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'premium', ls_subscription_status: 'active' })).toBe(true)
    })

    it('returns true for pro tier', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'pro', ls_subscription_status: 'active' })).toBe(true)
    })

    it('returns true for cancelled subscription (still in paid period)', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'premium', ls_subscription_status: 'cancelled' })).toBe(true)
    })

    it('returns false for free tier', () => {
      expect(isPremium(MOCK_PROFILE)).toBe(false)
    })

    it('returns false for expired subscription', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'free', ls_subscription_status: 'expired' })).toBe(false)
    })

    it('returns false for past_due subscription', () => {
      expect(isPremium({ ...MOCK_PROFILE, tier: 'premium', ls_subscription_status: 'past_due' })).toBe(false)
    })

    it('returns false for null profile', () => {
      expect(isPremium(null)).toBe(false)
    })
  })

  describe('getProfile', () => {
    it('returns profile when user is authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-1' } }, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
          }),
        }),
      })

      const result = await getProfile()
      expect(result).toEqual({ user: { id: 'user-uuid-1' }, profile: MOCK_PROFILE })
    })

    it('returns null user and profile when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

      const result = await getProfile()
      expect(result).toEqual({ user: null, profile: null })
    })
  })

  describe('createProfile', () => {
    it('inserts profile with given user id and tag', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
        }),
      })
      mockFrom.mockReturnValue({ insert: mockInsert })

      const result = await createProfile('user-uuid-1', '#YJU282PV')
      expect(result).toEqual(MOCK_PROFILE)
      expect(mockInsert).toHaveBeenCalledWith({ id: 'user-uuid-1', player_tag: '#YJU282PV' })
    })
  })
})
