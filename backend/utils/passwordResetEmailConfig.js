export function validatePasswordResetEmailConfig(settings) {
  const missingSettings = []
  if (!settings.smtpHost) missingSettings.push('SMTP_HOST')
  if (!settings.smtpFrom) missingSettings.push('SMTP_FROM')
  if (missingSettings.length > 0) {
    const error = new Error(
      `${missingSettings.join(' and ')} must be configured.`,
    )
    error.code = 'SMTP_CONFIG_MISSING'
    error.missingSettings = missingSettings
    throw error
  }
  if (
    !Number.isInteger(settings.smtpPort) ||
    settings.smtpPort < 1 ||
    settings.smtpPort > 65535
  ) {
    const error = new Error('SMTP_PORT must be a valid port number.')
    error.code = 'SMTP_CONFIG_INVALID'
    error.missingSettings = ['SMTP_PORT']
    throw error
  }
  if (Boolean(settings.smtpUser) !== Boolean(settings.smtpPassword)) {
    const error = new Error('SMTP_USER and SMTP_PASSWORD must both be configured.')
    error.code = 'SMTP_AUTH_CONFIG_INCOMPLETE'
    error.missingSettings = ['SMTP_USER', 'SMTP_PASSWORD']
    throw error
  }
}

export function isPasswordResetEmailAccepted(info, recipient) {
  return (
    Array.isArray(info?.accepted) &&
    info.accepted.some(
      (address) =>
        typeof address === 'string' &&
        address.toLowerCase() === recipient.toLowerCase(),
    )
  )
}
