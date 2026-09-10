const target = new URL(process.env.PLAYWRIGHT_BASE_URL || 'https://thegioitrimun.vn');
const productionHosts = new Set(['thegioitrimun.vn', 'www.thegioitrimun.vn']);
export const allowE2EMutation = process.env.E2E_ALLOW_MUTATION === '1'
  && Boolean(process.env.PLAYWRIGHT_BASE_URL)
  && !productionHosts.has(target.hostname.toLowerCase());

export function createE2ELabel(prefix: string) {
  const timestamp = Date.now();
  return {
    name: `E2E ${prefix} ${timestamp}`,
    slug: `e2e-${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp}`,
  };
}
