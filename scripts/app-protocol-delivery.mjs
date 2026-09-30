const EXPECTED_DELIVERY = {
  desktopPackage: 'local-smoke',
  signing: 'unverified',
  updater: 'template-only',
  webDeployment: 'unverified',
  mobileNative: 'local-debug',
}

export function validateProtocolDelivery(protocol) {
  if (!isRecord(protocol)) return ['Protocol must be a JSON object.']

  const errors = []
  if (protocol.schemaVersion !== 1) errors.push('schemaVersion must be 1.')
  if (!sameRecord(protocol.delivery, EXPECTED_DELIVERY)) {
    errors.push('delivery must retain the currently evidenced release boundary (protocol release boundary).')
  }
  return errors
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameRecord(actual, expected) {
  if (!isRecord(actual)) return false
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => actual[key] === expected[key])
}
