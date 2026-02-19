export class GitLabApiError extends Error {
  statusCode: number
  gitlabMessage: string

  constructor(statusCode: number, gitlabMessage: string) {
    super(`GitLab API error ${statusCode}: ${gitlabMessage}`)
    this.name = 'GitLabApiError'
    this.statusCode = statusCode
    this.gitlabMessage = gitlabMessage
  }
}

export class GitLabConnectionError extends Error {
  declare cause: Error

  constructor(cause: Error) {
    super(`GitLab connection error: ${cause.message}`)
    this.name = 'GitLabConnectionError'
    this.cause = cause
  }
}

export class ValidationError extends Error {
  paramName: string

  constructor(paramName: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.paramName = paramName
  }
}
