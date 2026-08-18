export const allowE2EMutation = process.env.E2E_ALLOW_MUTATION === '1';

export function createE2ELabel(prefix: string) {
  const timestamp = Date.now();
  return {
    name: `E2E ${prefix} ${timestamp}`,
    slug: `e2e-${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp}`,
  };
}
