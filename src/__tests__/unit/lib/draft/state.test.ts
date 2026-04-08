import { describe, it, expect } from 'vitest'
import { createInitialState, draftReducer, type DraftAction } from '@/lib/draft/state'

describe('Draft State Machine', () => {
  it('starts in IDLE state', () => {
    const state = createInitialState()
    expect(state.phase).toBe('IDLE')
    expect(state.blueTeam).toEqual([null, null, null])
    expect(state.redTeam).toEqual([null, null, null])
  })

  it('SELECT_MODE transitions to SELECT_MAP', () => {
    let state = createInitialState()
    state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
    expect(state.phase).toBe('SELECT_MAP')
    expect(state.mode).toBe('gemGrab')
  })

  it('SELECT_MAP transitions to SELECT_STARTER', () => {
    let state = createInitialState()
    state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
    state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
    expect(state.phase).toBe('SELECT_STARTER')
    expect(state.map).toBe('Hard Rock Mine')
  })

  it('SELECT_STARTER transitions to DRAFTING', () => {
    let state = createInitialState()
    state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
    state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
    state = draftReducer(state, { type: 'SELECT_STARTER', starter: 'blue' })
    expect(state.phase).toBe('DRAFTING')
    expect(state.starter).toBe('blue')
  })

  describe('Pick order: Blue starts (1-2-2-1)', () => {
    function setupDrafting() {
      let state = createInitialState()
      state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
      state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
      state = draftReducer(state, { type: 'SELECT_STARTER', starter: 'blue' })
      return state
    }

    it('Turn 1: Blue picks 1 (B1)', () => {
      let state = setupDrafting()
      expect(state.currentTeam).toBe('blue')
      expect(state.picksInTurn).toBe(1)

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 })
      expect(state.blueTeam[0]).toBe(100)
      expect(state.currentTeam).toBe('red')
      expect(state.picksInTurn).toBe(2)
    })

    it('Turn 2: Red picks 2 (R1, R2)', () => {
      let state = setupDrafting()
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 }) // B1

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 }) // R1
      expect(state.redTeam[0]).toBe(200)
      expect(state.currentTeam).toBe('red') // still red's turn

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 201 }) // R2
      expect(state.redTeam[1]).toBe(201)
      expect(state.currentTeam).toBe('blue') // now blue's turn
    })

    it('Turn 3: Blue picks 2 (B2, B3)', () => {
      let state = setupDrafting()
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 }) // B1
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 }) // R1
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 201 }) // R2

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 101 }) // B2
      expect(state.blueTeam[1]).toBe(101)
      expect(state.currentTeam).toBe('blue') // still blue

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 102 }) // B3
      expect(state.blueTeam[2]).toBe(102)
      expect(state.currentTeam).toBe('red') // now red
    })

    it('Turn 4: Red picks 1 (R3) → COMPLETE', () => {
      let state = setupDrafting()
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 }) // B1
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 }) // R1
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 201 }) // R2
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 101 }) // B2
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 102 }) // B3

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 202 }) // R3
      expect(state.redTeam[2]).toBe(202)
      expect(state.phase).toBe('COMPLETE')
    })
  })

  describe('Pick order: Red starts (1-2-2-1)', () => {
    function setupDrafting() {
      let state = createInitialState()
      state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
      state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
      state = draftReducer(state, { type: 'SELECT_STARTER', starter: 'red' })
      return state
    }

    it('Turn 1: Red picks 1 (R1)', () => {
      let state = setupDrafting()
      expect(state.currentTeam).toBe('red')

      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 })
      expect(state.redTeam[0]).toBe(200)
      expect(state.currentTeam).toBe('blue')
    })

    it('Full draft Red starts: R1 → B1,B2 → R2,R3 → B3', () => {
      let state = setupDrafting()
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 }) // R1
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 }) // B1
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 101 }) // B2
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 201 }) // R2
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 202 }) // R3
      state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 102 }) // B3

      expect(state.blueTeam).toEqual([100, 101, 102])
      expect(state.redTeam).toEqual([200, 201, 202])
      expect(state.phase).toBe('COMPLETE')
    })
  })

  it('UNDO removes last pick and cascading', () => {
    let state = createInitialState()
    state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
    state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
    state = draftReducer(state, { type: 'SELECT_STARTER', starter: 'blue' })
    state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 }) // B1
    state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 }) // R1

    state = draftReducer(state, { type: 'UNDO' })
    expect(state.redTeam[0]).toBeNull()
    expect(state.blueTeam[0]).toBe(100) // B1 still there
    expect(state.currentTeam).toBe('red')
  })

  it('RESET returns to IDLE', () => {
    let state = createInitialState()
    state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
    state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
    state = draftReducer(state, { type: 'RESET' })
    expect(state.phase).toBe('IDLE')
    expect(state.mode).toBeNull()
  })

  it('tracks all picked IDs correctly', () => {
    let state = createInitialState()
    state = draftReducer(state, { type: 'SELECT_MODE', mode: 'gemGrab' })
    state = draftReducer(state, { type: 'SELECT_MAP', map: 'Hard Rock Mine', eventId: 123 })
    state = draftReducer(state, { type: 'SELECT_STARTER', starter: 'blue' })
    state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 100 })
    state = draftReducer(state, { type: 'PICK_BRAWLER', brawlerId: 200 })

    expect(state.pickedIds.has(100)).toBe(true)
    expect(state.pickedIds.has(200)).toBe(true)
    expect(state.pickedIds.has(300)).toBe(false)
  })
})
