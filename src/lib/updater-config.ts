export function isUpdaterEndpointConfigured(endpoints: string[]): boolean {
  return (
    endpoints.length > 0 &&
    endpoints.every((endpoint) => {
      try {
        const url = new URL(endpoint)
        return (
          url.protocol === 'https:' &&
          !url.hostname.includes('OWNER') &&
          !url.pathname.split('/').some((segment) => segment === 'OWNER' || segment === 'REPO')
        )
      } catch {
        return false
      }
    })
  )
}

export function isUpdaterConfiguredForBuild(): boolean {
  return typeof __UPDATER_CONFIGURED__ !== 'undefined' && __UPDATER_CONFIGURED__
}
