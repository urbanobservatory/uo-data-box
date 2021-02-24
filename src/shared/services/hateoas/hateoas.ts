interface HATEOASConfig {
  majorVersion: number;
  baseURL: string;
}

interface HATEOASLink {
  href: string;
  rel: string;
  method?: string;
}

let basicConfig = null;
let globalPrefix = '';
export function initialiseHATEOAS(config: HATEOASConfig) {
  basicConfig = config;
  globalPrefix = `${config.baseURL}v${config.majorVersion}`;
}

export function generateLinks(links: HATEOASLink[]) {
  if (!links || !Array.isArray(links) || !links.length) return undefined;
  return links.map((l: HATEOASLink) => ({
    ...l,
    href: `${globalPrefix}${l.href}`
  }));
}
