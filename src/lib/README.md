# Request Tracing & Guest Identity

## Usage

### Request Tracing

Use the `tracedAxios` instance instead of the default `axios` import:

```typescript
import { tracedAxios } from '@/src/lib/requestTracing';

// All requests automatically include:
// - x-request-id: Unique UUID per request
// - x-guest-id: Guest identity UUID
const response = await tracedAxios.get('https://api.example.com/data');
```

### Guest Identity

Get or create a guest ID:

```typescript
import { getOrCreateGuestId, clearGuestId } from '@/src/lib/guestIdentity';

// Get the guest ID (creates one if it doesn't exist)
const guestId = await getOrCreateGuestId();

// Clear guest ID (for GDPR compliance)
await clearGuestId();
```

Both functions are fail-soft: they will not block the app if SecureStore fails.
















