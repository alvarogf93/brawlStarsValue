import { describe, it, expect } from 'vitest'
import { isValidPlayerTag, normalizePlayerTag, formatGems, formatTrophies, handleApiError, ApiErrorObj } from '../../../lib/utils'

describe('utils', () => {
  describe('isValidPlayerTag', () => {
    it('returns true for valid tags', () => {
      expect(isValidPlayerTag('#2P0Q8C2C0')).toBe(true)
      expect(isValidPlayerTag('2P0Q8C2C0')).toBe(false)
      expect(isValidPlayerTag('#ABC')).toBe(true)
    })
    
    it('returns false for invalid tags', () => {
      expect(isValidPlayerTag('#12')).toBe(false) // too short
      expect(isValidPlayerTag('#2P0Q8C2C0TOOLONGFORSURE')).toBe(false) // too long
    })
  })

  describe('normalizePlayerTag', () => {
    it('normalizes tags correctly', () => {
      expect(normalizePlayerTag('2p0q8c2c0')).toBe('#2P0Q8C2C0')
      expect(normalizePlayerTag(' #2p0q ')).toBe('#2P0Q')
    })
  })

  describe('formatGems', () => {
    it('formats gems correctly', () => {
      expect(formatGems(5000)).toBe('5,000 Gemas')
    })
  })

  describe('formatTrophies', () => {
    it('formats trophies correctly', () => {
      expect(formatTrophies(35000)).toBe('35,000')
    })
  })

  describe('handleApiError', () => {
    it('handles ApiError correctly', () => {
      const err = new ApiErrorObj(400, 'Bad req')
      expect(handleApiError(err)).toBe(err)
    })
    
    it('handles generic errors', () => {
      const err = new Error('Generic')
      const handled = handleApiError(err)
      expect(handled.code).toBe(500)
      expect(handled.message).toBe('Generic')
    })
  })
})
