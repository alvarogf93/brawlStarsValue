import type { DraftMode } from './constants'

// ── Types ────────────────────────────────────────────────────

export type DraftPhase = 'IDLE' | 'SELECT_MAP' | 'SELECT_STARTER' | 'DRAFTING' | 'COMPLETE'
export type Team = 'blue' | 'red'

export interface DraftState {
  phase: DraftPhase
  mode: DraftMode | null
  map: string | null
  eventId: number | null
  starter: Team | null
  blueTeam: (number | null)[]  // 3 slots
  redTeam: (number | null)[]   // 3 slots
  pickHistory: { team: Team; slotIndex: number; brawlerId: number }[]
  currentTeam: Team
  picksInTurn: number          // how many picks remaining in current turn
  picksCompletedInTurn: number // how many done so far in this turn
  pickedIds: Set<number>
}

export type DraftAction =
  | { type: 'SELECT_MODE'; mode: DraftMode }
  | { type: 'SELECT_MAP'; map: string; eventId: number }
  | { type: 'SELECT_STARTER'; starter: Team }
  | { type: 'PICK_BRAWLER'; brawlerId: number }
  | { type: 'UNDO' }
  | { type: 'RESET' }

// ── Pick Order ───────────────────────────────────────────────

/**
 * 1-2-2-1 draft order.
 * Each entry: [team, numberOfPicks]
 */
function getPickOrder(starter: Team): [Team, number][] {
  const other: Team = starter === 'blue' ? 'red' : 'blue'
  return [
    [starter, 1],
    [other, 2],
    [starter, 2],
    [other, 1],
  ]
}

/** Compute current turn state from pick history */
function computeTurnState(starter: Team, totalPicks: number): { team: Team; picksInTurn: number; picksCompletedInTurn: number } {
  const order = getPickOrder(starter)
  let consumed = 0

  for (const [team, count] of order) {
    if (consumed + count > totalPicks) {
      return {
        team,
        picksInTurn: count,
        picksCompletedInTurn: totalPicks - consumed,
      }
    }
    consumed += count
  }

  // All 6 picks done
  return { team: starter, picksInTurn: 0, picksCompletedInTurn: 0 }
}

// ── Initial State ────────────────────────────────────────────

export function createInitialState(): DraftState {
  return {
    phase: 'IDLE',
    mode: null,
    map: null,
    eventId: null,
    starter: null,
    blueTeam: [null, null, null],
    redTeam: [null, null, null],
    pickHistory: [],
    currentTeam: 'blue',
    picksInTurn: 1,
    picksCompletedInTurn: 0,
    pickedIds: new Set(),
  }
}

// ── Reducer ──────────────────────────────────────────────────

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'SELECT_MODE':
      return {
        ...createInitialState(),
        phase: 'SELECT_MAP',
        mode: action.mode as DraftMode,
      }

    case 'SELECT_MAP':
      return {
        ...state,
        phase: 'SELECT_STARTER',
        map: action.map,
        eventId: action.eventId,
      }

    case 'SELECT_STARTER': {
      const turnState = computeTurnState(action.starter, 0)
      return {
        ...state,
        phase: 'DRAFTING',
        starter: action.starter,
        currentTeam: turnState.team,
        picksInTurn: turnState.picksInTurn,
        picksCompletedInTurn: 0,
      }
    }

    case 'PICK_BRAWLER': {
      if (state.phase !== 'DRAFTING') return state

      const team = state.currentTeam
      const teamSlots = team === 'blue' ? [...state.blueTeam] : [...state.redTeam]

      // Find first empty slot
      const slotIndex = teamSlots.findIndex(s => s === null)
      if (slotIndex === -1) return state // team full (shouldn't happen)

      teamSlots[slotIndex] = action.brawlerId

      const newBlue = team === 'blue' ? teamSlots : [...state.blueTeam]
      const newRed = team === 'red' ? teamSlots : [...state.redTeam]
      const newHistory = [...state.pickHistory, { team, slotIndex, brawlerId: action.brawlerId }]
      const newPickedIds = new Set(state.pickedIds)
      newPickedIds.add(action.brawlerId)

      const totalPicks = newHistory.length

      // Check if draft is complete (6 picks)
      if (totalPicks >= 6) {
        return {
          ...state,
          phase: 'COMPLETE',
          blueTeam: newBlue,
          redTeam: newRed,
          pickHistory: newHistory,
          pickedIds: newPickedIds,
        }
      }

      // Compute next turn state
      const turnState = computeTurnState(state.starter!, totalPicks)

      return {
        ...state,
        blueTeam: newBlue,
        redTeam: newRed,
        pickHistory: newHistory,
        pickedIds: newPickedIds,
        currentTeam: turnState.team,
        picksInTurn: turnState.picksInTurn,
        picksCompletedInTurn: turnState.picksCompletedInTurn,
      }
    }

    case 'UNDO': {
      if (state.pickHistory.length === 0) return state

      const newHistory = state.pickHistory.slice(0, -1)
      const lastPick = state.pickHistory[state.pickHistory.length - 1]

      const newBlue = [...state.blueTeam]
      const newRed = [...state.redTeam]

      if (lastPick.team === 'blue') {
        newBlue[lastPick.slotIndex] = null
      } else {
        newRed[lastPick.slotIndex] = null
      }

      const newPickedIds = new Set<number>()
      for (const pick of newHistory) {
        newPickedIds.add(pick.brawlerId)
      }

      const totalPicks = newHistory.length
      const turnState = computeTurnState(state.starter!, totalPicks)

      return {
        ...state,
        phase: 'DRAFTING',
        blueTeam: newBlue,
        redTeam: newRed,
        pickHistory: newHistory,
        pickedIds: newPickedIds,
        currentTeam: turnState.team,
        picksInTurn: turnState.picksInTurn,
        picksCompletedInTurn: turnState.picksCompletedInTurn,
      }
    }

    case 'RESET':
      return createInitialState()

    default:
      return state
  }
}
