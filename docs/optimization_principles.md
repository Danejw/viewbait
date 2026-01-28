# Optimization Principles

This document defines core optimization principles for full-stack application development. These guidelines ensure performance, efficiency, and scalability across database, frontend, and memory management layers.

## Database Performance

### Schema Design Best Practices

#### Indexing Strategies

- **Primary Keys**: Always use indexed primary keys (typically auto-incrementing integers or UUIDs)
- **Foreign Keys**: Index all foreign key columns to speed up JOINs
- **Query Patterns**: Create indexes based on actual query patterns, not assumptions
  - Index columns used in WHERE clauses
  - Index columns used in ORDER BY clauses
  - Index columns used in JOIN conditions
- **Composite Indexes**: Create composite indexes for multi-column queries
  - Order matters: most selective column first
  - Example: `CREATE INDEX idx_user_status_date ON users(status, created_at)`
- **Partial Indexes**: Use partial indexes for filtered queries
  - Example: `CREATE INDEX idx_active_users ON users(email) WHERE status = 'active'`
- **Covering Indexes**: Include frequently selected columns in indexes to avoid table lookups
  - Example: `CREATE INDEX idx_user_cover ON users(status) INCLUDE (email, name)`

#### Normalization vs Denormalization

- **Normalize by Default**: Start with normalized schema (3NF) to prevent data anomalies
- **Denormalize Strategically**: Denormalize only when:
  - Read performance is critical and writes are infrequent
  - Joins are expensive and frequently executed
  - Data consistency can be maintained via application logic or triggers
- **Common Denormalization Patterns**:
  - Store computed aggregates (counts, sums) in parent tables
  - Duplicate frequently accessed foreign key data
  - Flatten hierarchical data for read-heavy queries

#### Data Types and Constraints

- **Choose Appropriate Types**: Use smallest data type that fits the data
  - Use `SMALLINT` instead of `INTEGER` for small ranges
  - Use `VARCHAR(n)` with appropriate length limits
  - Use `TIMESTAMP` instead of `VARCHAR` for dates
- **Add Constraints**: Use NOT NULL, CHECK, and UNIQUE constraints to enforce data integrity
- **Avoid Over-Engineering**: Don't create unnecessary abstractions or overly complex schemas

### Efficient Querying Techniques

#### Avoiding N+1 Queries

**Problem**: Executing one query per item in a collection
```sql
-- BAD: N+1 queries
SELECT * FROM users;
-- Then for each user:
SELECT * FROM orders WHERE user_id = 1;
SELECT * FROM orders WHERE user_id = 2;
-- ... N more queries
```

**Solutions**:
- **Eager Loading**: Load related data in a single query
  ```sql
  -- GOOD: Single query with JOIN
  SELECT u.*, o.*
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id;
  ```
- **Batch Loading**: Use IN clauses or array parameters
  ```sql
  -- GOOD: Batch query
  SELECT * FROM orders WHERE user_id IN (1, 2, 3, ...);
  ```
- **Data Loaders**: Use batching libraries (e.g., DataLoader pattern) to automatically batch requests

#### Query Optimization

- **Select Only Needed Columns**: Avoid `SELECT *`; specify required columns
- **Limit Result Sets**: Always use LIMIT for potentially large result sets
- **Use EXISTS Instead of COUNT**: For existence checks, `EXISTS` is faster than `COUNT(*) > 0`
- **Avoid Functions in WHERE Clauses**: Functions prevent index usage
  ```sql
  -- BAD: Can't use index on created_at
  WHERE DATE(created_at) = '2024-01-01'
  
  -- GOOD: Can use index
  WHERE created_at >= '2024-01-01' AND created_at < '2024-01-02'
  ```
- **Use EXPLAIN**: Analyze query plans to identify bottlenecks
- **Avoid SELECT DISTINCT When Possible**: Often indicates a design issue or missing JOIN condition

#### Pagination Strategies

- **Offset Pagination**: Simple but slow for large offsets
  ```sql
  SELECT * FROM items ORDER BY id LIMIT 20 OFFSET 1000;
  ```
- **Cursor Pagination**: Better for large datasets
  ```sql
  SELECT * FROM items WHERE id > last_seen_id ORDER BY id LIMIT 20;
  ```
- **Keyset Pagination**: Most efficient for sorted queries

### Transaction Management

#### Transaction Scope

- **Keep Transactions Short**: Minimize lock duration
- **Avoid Long-Running Operations**: Don't perform HTTP requests, file I/O, or user input within transactions
- **Use Appropriate Isolation Levels**: Default to READ COMMITTED; use SERIALIZABLE only when necessary
- **Batch Operations**: Group multiple writes into single transactions when possible

#### Locking Considerations

- **Row-Level Locks**: Prefer row-level locks over table locks
- **Avoid Deadlocks**: Always acquire locks in consistent order across transactions
- **Use SELECT FOR UPDATE Sparingly**: Only when you need pessimistic locking
- **Consider Optimistic Locking**: Use version columns for concurrent updates
  ```sql
  UPDATE items 
  SET quantity = quantity - 1, version = version + 1
  WHERE id = 123 AND version = current_version;
  ```

### Caching Strategies

#### Application-Level Caching

- **Cache Frequently Accessed Data**: User sessions, configuration, reference data
- **Cache Expiration**: Set appropriate TTLs based on data volatility
- **Cache Invalidation**: Implement invalidation strategies (time-based, event-based, manual)
- **Cache Keys**: Use consistent, namespaced key patterns
  - Example: `user:123:profile`, `product:456:details`

#### Database Query Caching

- **Materialized Views**: Pre-compute expensive aggregations
- **Query Result Caching**: Cache expensive query results with appropriate invalidation
- **Connection Pooling**: Reuse database connections to reduce overhead

#### Cache Patterns

- **Cache-Aside (Lazy Loading)**: Application checks cache, loads from DB if miss
- **Write-Through**: Write to cache and DB simultaneously
- **Write-Back**: Write to cache first, flush to DB asynchronously
- **Refresh-Ahead**: Proactively refresh cache before expiration

## Frontend Rendering & Performance

### Critical Rendering Path Optimization

#### HTML Optimization

- **Minimize DOM Size**: Reduce total number of DOM nodes
- **Avoid Deep Nesting**: Keep HTML structure shallow when possible
- **Defer Non-Critical Content**: Use lazy loading for below-fold content
- **Inline Critical CSS**: Inline CSS needed for above-fold rendering
- **Defer Non-Critical CSS**: Load non-critical stylesheets asynchronously
  ```html
  <link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  ```

#### JavaScript Loading

- **Defer Non-Critical Scripts**: Use `defer` or `async` attributes
- **Code Splitting**: Split code by route or feature
  - Next.js: Automatic route-based splitting
  - React: `React.lazy()` for component-level splitting
- **Tree Shaking**: Remove unused code from bundles
- **Minification**: Always minify production JavaScript
- **Module Bundling**: Use modern bundlers (Webpack, Vite, esbuild) with optimizations enabled

#### CSS Optimization

- **Remove Unused CSS**: Use tools like PurgeCSS
- **Critical CSS**: Extract and inline CSS needed for initial render
- **CSS-in-JS Considerations**: Be mindful of runtime overhead; prefer static extraction
- **Avoid @import**: Use `<link>` tags instead for parallel loading

### Component-Level Rendering Optimizations

#### React-Specific Optimizations

- **Memoization**: Use `React.memo()` for expensive components
  ```tsx
  const ExpensiveComponent = React.memo(({ data }) => {
    // Component logic
  }, (prevProps, nextProps) => {
    // Custom comparison if needed
    return prevProps.id === nextProps.id;
  });
  ```
- **useMemo and useCallback**: Memoize expensive computations and function references
  ```tsx
  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(data);
  }, [data]);
  
  const handleClick = useCallback(() => {
    // Handler logic
  }, [dependencies]);
  ```
- **Avoid Inline Object/Array Creation**: Don't create new objects/arrays in render
  ```tsx
  // BAD: New object on every render
  <Component style={{ margin: 10 }} />
  
  // GOOD: Stable reference
  const style = useMemo(() => ({ margin: 10 }), []);
  <Component style={style} />
  ```

#### Virtualization

- **Large Lists**: Use virtualization for lists with 100+ items
  - Libraries: `react-window`, `react-virtualized`, `@tanstack/react-virtual`
- **Virtual Scrolling**: Only render visible items
- **Windowing**: Render items in a sliding window around viewport

#### Code Splitting at Component Level

- **Lazy Loading Components**: Load components on demand
  ```tsx
  const LazyComponent = React.lazy(() => import('./LazyComponent'));
  
  <Suspense fallback={<Loading />}>
    <LazyComponent />
  </Suspense>
  ```

### Asset Optimization

#### Image Optimization

- **Modern Formats**: Use WebP or AVIF with fallbacks
  ```html
  <picture>
    <source srcset="image.avif" type="image/avif">
    <source srcset="image.webp" type="image/webp">
    <img src="image.jpg" alt="Description">
  </picture>
  ```
- **Responsive Images**: Use `srcset` and `sizes` attributes
- **Lazy Loading**: Load images as they enter viewport
  ```html
  <img src="image.jpg" loading="lazy" alt="Description">
  ```
- **Compression**: Compress images before serving (aim for 70-85% quality)
- **CDN**: Serve images from CDN with appropriate caching headers
- **Next.js Image Component**: Use `next/image` for automatic optimization

#### Web Fonts

- **Font Display Strategy**: Use `font-display: swap` or `optional`
  ```css
  @font-face {
    font-family: 'CustomFont';
    font-display: swap;
    src: url('font.woff2') format('woff2');
  }
  ```
- **Preload Critical Fonts**: Preload fonts needed for initial render
  ```html
  <link rel="preload" href="/fonts/critical.woff2" as="font" type="font/woff2" crossorigin>
  ```
- **Subset Fonts**: Include only needed characters
- **Self-Host When Possible**: Avoid external font loading when feasible

#### Other Assets

- **SVG Optimization**: Minify SVGs, remove unnecessary metadata
- **Icon Fonts vs SVG**: Prefer SVG sprites for better performance
- **Video Optimization**: Use appropriate codecs, provide multiple quality options

### Network Request Optimization

#### Reducing Payload Size

- **JSON Compression**: Enable gzip/brotli compression on server
- **API Response Optimization**: Return only needed fields
  - GraphQL: Request specific fields
  - REST: Use query parameters to filter fields
- **Pagination**: Implement pagination for large datasets
- **Data Transformation**: Transform data on server, not client

#### Request Batching

- **Batch API Calls**: Combine multiple requests when possible
- **GraphQL Batching**: Use DataLoader pattern for GraphQL resolvers
- **Request Deduplication**: Deduplicate identical concurrent requests

#### HTTP/2 and HTTP/3

- **HTTP/2 Multiplexing**: Multiple requests over single connection
- **Server Push**: Push critical resources (use sparingly)
- **HTTP/3**: Consider for high-latency connections

#### Preloading and Prefetching

- **Resource Hints**: Use `<link rel="preload">` for critical resources
- **DNS Prefetch**: Prefetch DNS for external domains
  ```html
  <link rel="dns-prefetch" href="https://api.example.com">
  ```
- **Prefetching**: Prefetch likely-needed resources
  ```html
  <link rel="prefetch" href="/next-page">
  ```

### State Management Considerations

#### State Structure

- **Normalize State**: Store data in normalized form (similar to database normalization)
- **Avoid Duplication**: Single source of truth for each piece of data
- **Derived State**: Compute derived state rather than storing it

#### State Updates

- **Immutable Updates**: Use immutable update patterns
- **Batch Updates**: Batch multiple state updates when possible
- **Selective Subscriptions**: Only subscribe to needed state slices

#### State Management Libraries

- **Zustand**: Lightweight, good for simple to medium complexity
- **Redux**: Use for complex state with time-travel debugging needs
- **Context API**: Use sparingly; avoid for frequently updating data
- **React Query/SWR**: Use for server state management with caching

## Memory Usage

### Efficient Data Structures and Algorithms

#### Data Structure Selection

- **Arrays vs Objects**: Use arrays for ordered, indexed data; objects for key-value lookups
- **Maps and Sets**: Use `Map` and `Set` for better performance with dynamic keys
- **WeakMap/WeakSet**: Use for garbage-collectable references
- **Typed Arrays**: Use typed arrays (Int8Array, Float32Array) for numeric data

#### Algorithm Complexity

- **Time Complexity**: Prefer O(n log n) or better algorithms
- **Space Complexity**: Consider memory trade-offs
- **Avoid Premature Optimization**: Profile first, optimize bottlenecks

### Memory Leak Prevention

#### Frontend Memory Leaks

**Event Listeners**:
```tsx
// BAD: Listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// GOOD: Cleanup listener
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

**Subscriptions**:
```tsx
// BAD: Subscription never unsubscribed
useEffect(() => {
  const subscription = observable.subscribe(handler);
}, []);

// GOOD: Unsubscribe on cleanup
useEffect(() => {
  const subscription = observable.subscribe(handler);
  return () => subscription.unsubscribe();
}, []);
```

**Timers**:
```tsx
// BAD: Timer never cleared
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
}, []);

// GOOD: Clear timer
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);
}, []);
```

**Closures**: Avoid closures that capture large objects unnecessarily

**DOM References**: Clear references to DOM nodes when components unmount

#### Backend Memory Leaks

**Stream Management**:
- Always close streams after use
- Use try-finally or try-with-resources patterns
```typescript
const stream = createReadStream('file.txt');
try {
  // Process stream
} finally {
  stream.close();
}
```

**Event Emitters**: Remove all listeners when done
```typescript
emitter.removeAllListeners('event');
```

**Caching**: Implement cache size limits and eviction policies

**Circular References**: Avoid circular object references that prevent garbage collection

### Garbage Collection Considerations

#### JavaScript/Node.js

- **V8 Heap**: Monitor heap usage; set appropriate `--max-old-space-size` if needed
- **Weak References**: Use WeakMap/WeakSet for cache-like structures
- **Object Pooling**: Reuse objects for frequently created/destroyed instances
- **Avoid Global Variables**: Minimize global state

#### Managed Languages Best Practices

- **Dispose Resources**: Implement IDisposable patterns (C#) or similar
- **Finalizers**: Avoid finalizers; use explicit cleanup instead
- **Large Object Heap**: Be mindful of large object allocations
- **Generational GC**: Understand generational garbage collection behavior

### Resource Pooling

#### Database Connection Pooling

- **Connection Limits**: Set appropriate pool size based on database limits
- **Connection Timeout**: Configure timeouts to prevent hanging connections
- **Idle Connections**: Close idle connections after timeout
- **Pool Monitoring**: Monitor pool usage and adjust size

```typescript
// Example: Connection pool configuration
const pool = new Pool({
  max: 20,              // Maximum connections
  min: 5,               // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Thread Pooling

- **Worker Threads**: Use worker threads for CPU-intensive tasks
- **Thread Pool Size**: Set based on CPU cores (typically cores - 1)
- **Task Queuing**: Queue tasks when pool is exhausted

#### Object Pooling

- **Reuse Objects**: Pool frequently allocated objects
- **Reset State**: Properly reset object state when returning to pool
- **Pool Size**: Limit pool size to prevent memory bloat

## Performance Monitoring and Measurement

### Metrics to Track

- **Time to First Byte (TTFB)**: Server response time
- **First Contentful Paint (FCP)**: First content rendered
- **Largest Contentful Paint (LCP)**: Largest content element rendered
- **Time to Interactive (TTI)**: When page becomes interactive
- **Cumulative Layout Shift (CLS)**: Visual stability
- **First Input Delay (FID)**: Input responsiveness

### Profiling Tools

- **Chrome DevTools**: Performance tab, Memory profiler
- **React DevTools Profiler**: Component render performance
- **Lighthouse**: Overall performance audit
- **WebPageTest**: Real-world performance testing
- **Database Query Analyzers**: EXPLAIN plans, slow query logs

### Continuous Monitoring

- **Real User Monitoring (RUM)**: Track actual user performance
- **Synthetic Monitoring**: Automated performance tests
- **Error Tracking**: Monitor performance-related errors
- **Alerting**: Set up alerts for performance degradation

## Anti-Patterns to Avoid

### Database

- ❌ Creating indexes on every column "just in case"
- ❌ Using SELECT * in production queries
- ❌ Storing large BLOBs in database (use object storage)
- ❌ N+1 queries in loops
- ❌ Long-running transactions
- ❌ Missing indexes on foreign keys
- ❌ Over-normalization leading to excessive JOINs

### Frontend

- ❌ Loading all JavaScript upfront
- ❌ Blocking render with synchronous operations
- ❌ Creating new objects/arrays in render
- ❌ Not memoizing expensive computations
- ❌ Loading full-size images on mobile
- ❌ Not using code splitting
- ❌ Excessive re-renders from context updates
- ❌ Memory leaks from uncleaned subscriptions

### Memory

- ❌ Storing large datasets in memory unnecessarily
- ❌ Not cleaning up event listeners
- ❌ Circular references preventing GC
- ❌ Global variables accumulating data
- ❌ Not closing streams/files
- ❌ Caching without size limits

## Summary

Optimization is an ongoing process that requires:

1. **Measurement First**: Profile and measure before optimizing
2. **Prioritize**: Focus on bottlenecks with highest impact
3. **Balance**: Consider trade-offs between complexity and performance
4. **Monitor**: Continuously track performance metrics
5. **Iterate**: Optimization is iterative, not one-time

Remember: Premature optimization is the root of all evil. Optimize based on actual performance data, not assumptions.
