export async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (err?.status === 429 || err?.error?.type === "rate_limit_error") {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        console.warn(`Rate limited, retrying in ${Math.round(delay)}ms (attempt ${i+1})`);
        await sleep(delay);
      } else {
        throw err; // non-rate-limit error, don't retry
      }
    }
  }
  throw lastError;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}