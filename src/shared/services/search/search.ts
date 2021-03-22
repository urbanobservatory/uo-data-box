export function parseSearchTerms(
  terms: string,
  maxTerms: number = 20
): string[] {
  const r = /"([^"]*)"|'([^']*)'|[^+\s]+/g
  const m = []

  let match,
    matchCount = 0
  while ((match = r.exec(terms))) {
    // Remove quotes from the groups we provide
    if (match[1]) {
      m.push(match[1])
    } else if (match[2]) {
      m.push(match[2])
    } else {
      m.push(match[0])
    }
    matchCount++

    if (matchCount >= maxTerms) {
      return m
    }
  }

  return m
}
