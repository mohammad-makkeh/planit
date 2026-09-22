// No app shell here — the print route renders the A4 pages directly, edge to edge. The route
// stays middleware-protected (it isn't under /p or /login), and the page itself re-checks
// requireCoachId as defense in depth, matching the (app) layout's convention.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children
}
