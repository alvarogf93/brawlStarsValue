# 13. Test-Driven Development (TDD) Strategy

**Obligatorio**: Desarrollar SIEMPRE con TDD. Tests PRIMERO, código DESPUÉS.

---

## 🎯 Principio TDD

```
Red → Green → Refactor

1. RED: Escribe test que FALLA
2. GREEN: Escribe código MÍNIMO que pase test
3. REFACTOR: Mejora código sin romper tests
```

---

## 📋 Test Execution Flow

### Desarrollo Normal

```bash
# En terminal:
npm run test:ui

# Watch mode - tests corren automáticamente al guardar
# UI muestra:
# - Tests passing ✅
# - Tests failing ❌
# - Coverage %
# - Each test file expandible
```

### Pre-commit

```bash
npm run test        # All tests must pass
npm run lint        # No linting errors
npm run type-check  # TypeScript strict compile
```

### CI/CD (GitHub Actions)

```bash
npm install
npm run lint
npm run test
npm run type-check
npm run build
```

---

## 📊 Test Structure por Componente

### **1. lib/calculate.ts** - Algoritmo de Valoración

**Test File**: `src/__tests__/unit/lib/calculate.test.ts`

```typescript
describe('calculateValue()', () => {
  // Test 1: Valid input returns correct value
  test('should calculate value correctly for valid player data', () => {
    // GIVEN: player data with specific trophies, exp, brawlers
    const playerData = {
      trophies: 35000,
      expLevel: 420,
      brawlers: [ /* 2 RARE, 4 SUPERRARE, 8 EPIC, 5 MYTHIC, 1 LEGENDARY */ ],
      '3v3Victories': 8500
    }
    
    // WHEN: calculateValue is called
    const result = calculateValue(playerData)
    
    // THEN: result matches expected value
    expect(result).toBe(450.75) // Or whatever the formula gives
  })

  // Test 2: Edge case - zero input
  test('should return 0 for empty/new player', () => {
    const playerData = {
      trophies: 0,
      expLevel: 0,
      brawlers: [],
      '3v3Victories': 0
    }
    
    expect(calculateValue(playerData)).toBe(0)
  })

  // Test 3: Edge case - max values
  test('should handle maximum values', () => {
    const playerData = {
      trophies: 999999,
      expLevel: 999,
      brawlers: [ /* 60 LEGENDARY */ ],
      '3v3Victories': 999999
    }
    
    const result = calculateValue(playerData)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeFinite()
  })

  // Test 4: Formula breakdown
  test('breakdown should sum to total value', () => {
    const playerData = { /* valid data */ }
    const result = calculateValue(playerData)
    
    const breakdownSum =
      result.breakdown.trophies.value +
      result.breakdown.experience.value +
      result.breakdown.brawlers.value +
      result.breakdown.victories.value
    
    expect(result.totalValue).toBe(breakdownSum)
  })

  // Test 5: Input validation
  test('should throw error for invalid input', () => {
    expect(() => calculateValue(null)).toThrow()
    expect(() => calculateValue(undefined)).toThrow()
    expect(() => calculateValue({})).toThrow()
  })
})
```

---

### **2. lib/utils.ts** - Utility Functions

**Test File**: `src/__tests__/unit/lib/utils.test.ts`

```typescript
describe('isValidPlayerTag()', () => {
  // Test: Valid formats
  test('should return true for valid player tags', () => {
    expect(isValidPlayerTag('#2P0Q8C2C0')).toBe(true)
    expect(isValidPlayerTag('#ABC')).toBe(true)
    expect(isValidPlayerTag('#ABCDEFGHIJ1234567890')).toBe(true) // 20 chars
  })

  // Test: Invalid formats
  test('should return false for invalid player tags', () => {
    expect(isValidPlayerTag('2P0Q8C2C0')).toBe(false) // No #
    expect(isValidPlayerTag('#')).toBe(false) // Too short
    expect(isValidPlayerTag('#AB')).toBe(false) // Too short (< 3)
    expect(isValidPlayerTag('#ABCDEFGHIJ12345678901')).toBe(false) // Too long (> 20)
    expect(isValidPlayerTag('#@#$%')).toBe(false) // Invalid chars
  })

  // Test: Case insensitivity
  test('should accept lowercase and uppercase', () => {
    expect(isValidPlayerTag('#abc123')).toBe(true)
    expect(isValidPlayerTag('#ABC123')).toBe(true)
    expect(isValidPlayerTag('#AbC123')).toBe(true)
  })
})

describe('formatCurrency()', () => {
  test('should format number as currency', () => {
    expect(formatCurrency(450.75)).toBe('$450.75')
    expect(formatCurrency(1000)).toBe('$1000.00')
    expect(formatCurrency(0)).toBe('$0.00')
  })

  test('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1000000.00')
  })

  test('should handle decimals correctly', () => {
    expect(formatCurrency(450.754)).toBe('$450.75') // Rounds to 2 decimals
    expect(formatCurrency(450.756)).toBe('$450.76')
  })
})

describe('formatTrophies()', () => {
  test('should add thousands separators', () => {
    expect(formatTrophies(1000)).toBe('1,000')
    expect(formatTrophies(35000)).toBe('35,000')
    expect(formatTrophies(999999)).toBe('999,999')
  })

  test('should handle small numbers', () => {
    expect(formatTrophies(100)).toBe('100')
    expect(formatTrophies(0)).toBe('0')
  })
})
```

---

### **3. hooks/useCalculateValue** - Main Hook

**Test File**: `src/__tests__/unit/hooks/useCalculateValue.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useCalculateValue } from '@/hooks/useCalculateValue'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Wrapper para Provider (QueryClient)
const createWrapper = () => {
  const queryClient = new QueryClient()
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useCalculateValue()', () => {
  // Test 1: Hook returns loading state initially
  test('should be in loading state on call', () => {
    const { result } = renderHook(() => useCalculateValue('#2P0Q8C2C0'), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()
  })

  // Test 2: Hook returns data after success
  test('should return data when calculation succeeds', async () => {
    const { result } = renderHook(() => useCalculateValue('#2P0Q8C2C0'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.totalValue).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  // Test 3: Null playerTag should not trigger request
  test('should not fetch when playerTag is null', () => {
    const { result } = renderHook(() => useCalculateValue(null), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  // Test 4: Cache hit on same playerTag
  test('should use cached data on second call with same tag', async () => {
    const { result, rerender } = renderHook(
      (tag: string | null) => useCalculateValue(tag),
      { wrapper: createWrapper(), initialProps: '#2P0Q8C2C0' }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const firstCallData = result.current.data

    rerender('#2P0Q8C2C0')

    expect(result.current.data).toBe(firstCallData) // Same reference
  })

  // Test 5: Error handling
  test('should handle 404 error gracefully', async () => {
    // Mock failed response
    const { result } = renderHook(() => useCalculateValue('#INVALID'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBeDefined()
  })
})
```

---

### **4. components/landing/InputForm** - Component

**Test File**: `src/__tests__/unit/components/landing/InputForm.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputForm } from '@/components/landing/InputForm'

describe('InputForm Component', () => {
  // Test 1: Component renders correctly
  test('should render input field and submit button', () => {
    const handleSubmit = vi.fn()
    render(<InputForm onSubmit={handleSubmit} />)

    expect(screen.getByPlaceholderText(/player tag/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /calcular/i })).toBeInTheDocument()
  })

  // Test 2: Validation on input change
  test('should show validation error for invalid tag', async () => {
    const handleSubmit = vi.fn()
    const user = userEvent.setup()
    
    render(<InputForm onSubmit={handleSubmit} />)
    const input = screen.getByPlaceholderText(/player tag/i)

    await user.type(input, 'invalid')
    
    expect(screen.getByText(/invalid format/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /calcular/i })).toBeDisabled()
  })

  // Test 3: Enable button on valid input
  test('should enable button for valid tag', async () => {
    const handleSubmit = vi.fn()
    const user = userEvent.setup()
    
    render(<InputForm onSubmit={handleSubmit} />)
    const input = screen.getByPlaceholderText(/player tag/i)
    const button = screen.getByRole('button', { name: /calcular/i })

    await user.type(input, '#2P0Q8C2C0')
    
    expect(button).not.toBeDisabled()
  })

  // Test 4: Submit on button click
  test('should call onSubmit when button clicked', async () => {
    const handleSubmit = vi.fn()
    const user = userEvent.setup()
    
    render(<InputForm onSubmit={handleSubmit} />)
    const input = screen.getByPlaceholderText(/player tag/i)
    const button = screen.getByRole('button', { name: /calcular/i })

    await user.type(input, '#2P0Q8C2C0')
    await user.click(button)

    expect(handleSubmit).toHaveBeenCalledWith('#2P0Q8C2C0')
  })

  // Test 5: Submit on Enter key
  test('should submit on Enter key', async () => {
    const handleSubmit = vi.fn()
    const user = userEvent.setup()
    
    render(<InputForm onSubmit={handleSubmit} />)
    const input = screen.getByPlaceholderText(/player tag/i)

    await user.type(input, '#2P0Q8C2C0{Enter}')

    expect(handleSubmit).toHaveBeenCalledWith('#2P0Q8C2C0')
  })

  // Test 6: Loading state
  test('should show loading state when isLoading true', () => {
    const handleSubmit = vi.fn()
    render(<InputForm onSubmit={handleSubmit} isLoading={true} />)
    
    const button = screen.getByRole('button', { name: /calcular/i })
    expect(button).toBeDisabled()
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument() // Spinner
  })
})
```

---

### **5. API Route: /api/calculate**

**Test File**: `src/__tests__/integration/api/calculate.test.ts`

```typescript
import { POST } from '@/app/api/calculate/route'
import { NextRequest } from 'next/server'

describe('POST /api/calculate', () => {
  // Test 1: Valid request returns 200
  test('should return 200 for valid player tag', async () => {
    const req = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({ playerTag: '#2P0Q8C2C0' })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.totalValue).toBeGreaterThan(0)
    expect(data.breakdown).toBeDefined()
  })

  // Test 2: Invalid format returns 400
  test('should return 400 for invalid player tag format', async () => {
    const req = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({ playerTag: 'invalid' })
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  // Test 3: Missing playerTag returns 400
  test('should return 400 for missing playerTag', async () => {
    const req = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({})
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  // Test 4: Response schema is correct
  test('should return correct response schema', async () => {
    const req = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({ playerTag: '#2P0Q8C2C0' })
    })

    const response = await POST(req)
    const data = await response.json()

    expect(data).toHaveProperty('playerTag')
    expect(data).toHaveProperty('playerName')
    expect(data).toHaveProperty('totalValue')
    expect(data).toHaveProperty('breakdown')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('cached')
  })

  // Test 5: Breakdown sums to total
  test('breakdown values should sum to total', async () => {
    const req = new NextRequest('http://localhost:3000/api/calculate', {
      method: 'POST',
      body: JSON.stringify({ playerTag: '#2P0Q8C2C0' })
    })

    const response = await POST(req)
    const data = await response.json()

    const sum =
      data.breakdown.trophies.value +
      data.breakdown.experience.value +
      data.breakdown.brawlers.value +
      data.breakdown.victories.value

    expect(data.totalValue).toBeCloseTo(sum, 2) // Within 2 decimals
  })
})
```

---

## 🔄 TDD Workflow Ejemplo

### Paso 1: Escribir Test (RED)

```typescript
// src/__tests__/unit/lib/calculate.test.ts
test('should calculate value correctly', () => {
  const playerData = { trophies: 35000, /* ... */ }
  const result = calculateValue(playerData)
  expect(result).toBe(450.75)
})
```

### Paso 2: Run Test (FAILS ❌)

```bash
npm run test
# FAIL: calculateValue is not defined
```

### Paso 3: Escribir Código Mínimo (GREEN)

```typescript
// src/lib/calculate.ts
export function calculateValue(playerData: PlayerData): number {
  return 450.75 // Hardcoded to pass test
}
```

### Paso 4: Run Test (PASSES ✅)

```bash
npm run test
# PASS: should calculate value correctly
```

### Paso 5: Refactor (IMPROVE)

```typescript
// src/lib/calculate.ts
export function calculateValue(playerData: PlayerData): number {
  const trophiesValue = playerData.trophies * 0.005
  const expValue = playerData.expLevel * 0.5
  // ... real algorithm
  return total
}
```

### Paso 6: Run Tests Again (STILL PASS ✅)

```bash
npm run test
# PASS: All tests still pass
```

---

## 📈 Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Lines | 80%+ | 0% (MVP) |
| Functions | 80%+ | 0% (MVP) |
| Branches | 80%+ | 0% (MVP) |
| Statements | 80%+ | 0% (MVP) |

**Check Coverage**:
```bash
npm run test:coverage
# Generates HTML report in coverage/
```

---

## 🚦 CI/CD Testing Gate

**GitHub Actions** (`/.github/workflows/ci.yml`):

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run lint       # Must pass
      - run: npm run test       # Must pass
      - run: npm run test:coverage  # Check % threshold
      - run: npm run type-check # Must pass
      - run: npm run build      # Must build successfully
```

**Merge to `main` es bloqueado si:**
- ❌ Tests fallan
- ❌ Coverage < 80%
- ❌ Linting errors
- ❌ TypeScript compilation errors
- ❌ Build fails

---

## ✅ Checklist TDD Pre-Desarrollo

- [ ] Vitest configurado (`npm run test` funciona)
- [ ] Vitest UI funciona (`npm run test:ui`)
- [ ] Testing Library instalada
- [ ] Mock setup en `src/test/setup.ts`
- [ ] First test escrito y falla (RED)
- [ ] CI/CD workflow `.github/workflows/ci.yml` creado
- [ ] Branch protection rule: require passing CI

---

## 📚 Referencias

- [Vitest Documentation](https://vitest.dev)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library User Event](https://testing-library.com/user-event)
- [Playwright Testing](https://playwright.dev)
- [TDD Best Practices](https://refactoring.guru/refactoring/techniques/tdd)
