export interface CreateProxyWretchOptions {
  proxy: string;
  proxyHeaders?: Record<string, string>;
  onProxyConnect?: (headers: Map<string, string>) => void;
}

export function createProxyWretch(
  options: CreateProxyWretchOptions
): Promise<typeof import('wretch').default>;
