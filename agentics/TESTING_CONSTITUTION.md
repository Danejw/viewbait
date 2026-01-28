# Testing Constitution

This document defines our strategy and requirements for unit testing. All development must follow Test-Driven Development (TDD) principles, ensuring quality, maintainability, and confidence in our codebase.

## Purpose

We follow a **Test-Driven Development (TDD)** approach where unit tests are written *before* implementing features. This practice:

- Ensures features are designed with testability in mind
- Provides immediate feedback on correctness
- Creates living documentation of expected behavior
- Prevents regressions through comprehensive test coverage
- Encourages better code design through test-first thinking

**Core Principle**: Tests define the contract and expected behavior before implementation begins.

## What to Test

### Required Coverage

Every new feature or change must have corresponding unit tests that cover:

1. **Happy Paths**: Normal operation with valid inputs
2. **Edge Cases**: Boundary conditions, empty inputs, null values, extreme values
3. **Error Conditions**: Invalid inputs, error handling, exception scenarios
4. **Business Logic**: All business rules and calculations
5. **State Changes**: Functions that modify state or return different outputs

### Scope of Unit Tests

Unit tests should focus on:

- **Individual Functions**: Pure functions, utility functions, helper methods
- **Component Logic**: React component logic (not rendering), hooks, state management
- **Service Methods**: Business logic in service layers
- **Data Transformations**: Data formatting, validation, transformation functions
- **Isolated Behavior**: Single responsibility, single unit of work

### Example: What to Test

```typescript
// Function to test
export function calculateDiscount(price: number, discountPercent: number): number {
  if (price < 0) throw new Error('Price cannot be negative');
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  return price * (1 - discountPercent / 100);
}

// Unit tests should cover:
// ✅ Happy path: calculateDiscount(100, 10) => 90
// ✅ Edge case: calculateDiscount(0, 10) => 0
// ✅ Edge case: calculateDiscount(100, 0) => 100
// ✅ Edge case: calculateDiscount(100, 100) => 0
// ✅ Error: calculateDiscount(-10, 10) => throws Error
// ✅ Error: calculateDiscount(100, -5) => throws Error
// ✅ Error: calculateDiscount(100, 150) => throws Error
```

## What NOT to Test (Unit Tests)

Unit tests should **NOT** test:

### ❌ Complex Integrations

- Multi-component interactions
- End-to-end workflows
- Full application flows
- **Note**: These belong in integration or E2E tests (out of scope for this constitution)

### ❌ External Services

- Database queries (mock the database client)
- API calls (mock HTTP requests)
- Third-party services (mock external dependencies)
- File system operations (mock file I/O)
- Network requests (mock fetch/axios)

### ❌ UI Rendering (Generally)

- Visual appearance
- CSS styling
- Layout positioning
- **Exception**: Test UI component logic (e.g., conditional rendering, state-driven UI changes)

### ❌ User Interactions

- Click events (unless testing event handler logic)
- Form submissions (unless testing validation logic)
- Navigation flows
- **Exception**: Test the logic triggered by interactions, not the interaction itself

### Example: What NOT to Test

```typescript
// ❌ DON'T test database directly
test('should save user to database', async () => {
  const user = await db.users.create({ name: 'John' });
  expect(user).toBeDefined();
});

// ✅ DO mock the database
test('should call database with correct data', async () => {
  const mockDb = { users: { create: jest.fn() } };
  await createUser(mockDb, { name: 'John' });
  expect(mockDb.users.create).toHaveBeenCalledWith({ name: 'John' });
});

// ❌ DON'T test full component rendering
test('should render user profile', () => {
  render(<UserProfile user={mockUser} />);
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});

// ✅ DO test component logic
test('should format user name correctly', () => {
  const formatted = formatUserName({ first: 'John', last: 'Doe' });
  expect(formatted).toBe('John Doe');
});
```

## Development Workflow

All feature development must follow this TDD workflow:

### Step 1: Write Unit Test

**Before** implementing a feature:

1. Write one or more unit tests that define the expected behavior
2. Tests should be specific and cover:
   - The primary use case (happy path)
   - Edge cases
   - Error conditions
3. **Tests should initially fail** (Red phase)
4. Commit the failing tests with a clear message: `test: add failing tests for [feature]`

**Example**:
```typescript
// test: add failing tests for calculateDiscount
describe('calculateDiscount', () => {
  it('should calculate 10% discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });
  
  it('should throw error for negative price', () => {
    expect(() => calculateDiscount(-10, 10)).toThrow('Price cannot be negative');
  });
});
```

### Step 2: Implement Feature

Write the **minimal code necessary** to make the tests pass:

1. Implement only what's needed to satisfy the tests
2. Don't add extra features or optimizations yet
3. Focus on making tests green (Green phase)
4. Run tests frequently to ensure progress

**Example**:
```typescript
// Minimal implementation to pass tests
export function calculateDiscount(price: number, discountPercent: number): number {
  if (price < 0) throw new Error('Price cannot be negative');
  return price * (1 - discountPercent / 100);
}
```

### Step 3: Run Tests

Execute all relevant unit tests:

1. Run new tests to verify they pass
2. Run existing tests to ensure no regressions
3. Fix any failing tests before proceeding
4. Ensure 100% of new tests pass

**Commands**:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- calculateDiscount.test.ts
```

### Step 4: Refactor (if necessary)

If tests pass, improve the code:

1. Refactor for maintainability, readability, or performance
2. Ensure all tests continue to pass after refactoring
3. Add additional tests if refactoring reveals edge cases
4. Commit refactored code: `refactor: improve [feature] implementation`

**Example**:
```typescript
// Refactored with better error handling
export function calculateDiscount(price: number, discountPercent: number): number {
  validatePrice(price);
  validateDiscountPercent(discountPercent);
  return applyDiscount(price, discountPercent);
}
```

### Step 5: Iterate

Repeat the cycle for subsequent development tasks:

1. Write test for next feature/change
2. Implement minimal code
3. Run tests
4. Refactor if needed
5. Continue to next task

## Agent Instructions

When implementing a new feature or making a change, agents must:

### 1. Read and Understand

- **First**: Read and understand this `TESTING_CONSTITUTION.md` file
- Understand the TDD workflow and requirements
- Identify what should and should not be tested

### 2. Write Tests First

- Write unit tests that clearly define the new behavior
- Tests should initially fail (they test functionality that doesn't exist yet)
- Cover happy paths, edge cases, and error conditions
- Use descriptive test names that explain the expected behavior

### 3. Implement Feature

- Write the minimal code necessary to make tests pass
- Don't add extra features beyond what tests require
- Focus on correctness first, optimization later

### 4. Verify and Iterate

- Run all tests (new and existing) to ensure:
  - New tests pass
  - No existing tests break
  - No regressions introduced
- Refactor if needed, ensuring tests continue to pass
- Iterate until all tests pass and feature meets requirements

### 5. Commit Strategy

Follow this commit pattern:

```
test: add failing tests for [feature name]
feat: implement [feature name]
test: add tests for edge cases in [feature name]
refactor: improve [feature name] implementation
```

## Test Structure and Best Practices

### Test File Organization

- Place test files next to source files: `utils.test.ts` alongside `utils.ts`
- Or in `__tests__` directories: `__tests__/utils.test.ts`
- Use descriptive file names: `calculateDiscount.test.ts`

### Test Naming

- Use descriptive test names that explain behavior
- Follow pattern: `should [expected behavior] when [condition]`

**Good Examples**:
```typescript
it('should return 90 when calculating 10% discount on 100', () => {});
it('should throw error when price is negative', () => {});
it('should handle zero discount correctly', () => {});
```

**Bad Examples**:
```typescript
it('test 1', () => {});
it('works', () => {});
it('calculateDiscount', () => {});
```

### Test Structure (AAA Pattern)

Organize tests using Arrange-Act-Assert:

```typescript
it('should calculate discount correctly', () => {
  // Arrange: Set up test data
  const price = 100;
  const discountPercent = 10;
  
  // Act: Execute the function
  const result = calculateDiscount(price, discountPercent);
  
  // Assert: Verify the result
  expect(result).toBe(90);
});
```

### Mocking and Stubbing

- Mock external dependencies (databases, APIs, file system)
- Use dependency injection to enable mocking
- Keep mocks simple and focused

**Example**:
```typescript
// Mock external API
jest.mock('@/lib/api', () => ({
  fetchUser: jest.fn(),
}));

test('should format user data', async () => {
  const mockFetchUser = require('@/lib/api').fetchUser;
  mockFetchUser.mockResolvedValue({ id: 1, name: 'John' });
  
  const result = await formatUserData(1);
  expect(result).toBe('John (ID: 1)');
});
```

### Test Isolation

- Each test should be independent
- Tests should not depend on execution order
- Clean up after each test (use `beforeEach`, `afterEach`)

## Coverage Requirements

### Minimum Coverage

- **New Code**: 100% coverage for new features
- **Modified Code**: Maintain or improve existing coverage
- **Critical Paths**: Business logic must have comprehensive coverage

### Coverage Tools

- Use coverage tools to track test coverage
- Aim for high coverage, but prioritize meaningful tests over coverage percentage
- Review coverage reports regularly

**Commands**:
```bash
# Run tests with coverage
npm test -- --coverage

# Generate coverage report
npm test -- --coverage --coverageReporters=html
```

## Common Pitfalls to Avoid

### ❌ Testing Implementation Details

Don't test how something is implemented, test what it does:

```typescript
// ❌ BAD: Testing implementation
test('should call setState', () => {
  const component = render(<Component />);
  expect(component.state).toBeCalled();
});

// ✅ GOOD: Testing behavior
test('should display error message when validation fails', () => {
  render(<Component />);
  fireEvent.click(screen.getByText('Submit'));
  expect(screen.getByText('Invalid input')).toBeInTheDocument();
});
```

### ❌ Over-Mocking

Don't mock everything; only mock external dependencies:

```typescript
// ❌ BAD: Mocking internal functions
jest.mock('./utils', () => ({
  formatDate: jest.fn(),
}));

// ✅ GOOD: Mocking external API
jest.mock('axios', () => ({
  get: jest.fn(),
}));
```

### ❌ Testing Multiple Things

One test should verify one behavior:

```typescript
// ❌ BAD: Testing multiple behaviors
test('should validate and save user', () => {
  // Too many things
});

// ✅ GOOD: Separate tests
test('should validate user input', () => {});
test('should save valid user', () => {});
```

### ❌ Ignoring Failing Tests

Never commit failing tests or skip tests without fixing them:

```typescript
// ❌ BAD: Skipping or ignoring failures
test.skip('should work', () => {});
// or
test('should work', () => {
  // expect(true).toBe(false); // commented out
});
```

## Summary

This Testing Constitution establishes:

1. **TDD is mandatory**: Tests before implementation
2. **Comprehensive coverage**: Happy paths, edge cases, errors
3. **Clear boundaries**: What to test and what not to test
4. **Structured workflow**: Red-Green-Refactor cycle
5. **Agent compliance**: Agents must follow this constitution

**Remember**: Tests are not a burden; they are a safety net, documentation, and design tool. Writing tests first leads to better, more maintainable code.
