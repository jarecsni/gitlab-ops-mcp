import { ValidationError } from './errors.js'

export function requireParam(params: Record<string, unknown>, name: string): unknown {
  const value = params[name]
  if (value === undefined || value === null) {
    throw new ValidationError(name, `Missing required parameter: ${name}`)
  }
  return value
}

export function requireString(params: Record<string, unknown>, name: string): string {
  const value = requireParam(params, name)
  if (typeof value !== 'string') {
    throw new ValidationError(name, `Parameter '${name}' must be a string`)
  }
  return value
}

export function requireNumber(params: Record<string, unknown>, name: string): number {
  const value = requireParam(params, name)
  if (typeof value !== 'number') {
    throw new ValidationError(name, `Parameter '${name}' must be a number`)
  }
  return value
}

export function optionalString(params: Record<string, unknown>, name: string): string | undefined {
  const value = params[name]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new ValidationError(name, `Parameter '${name}' must be a string`)
  }
  return value
}

export function optionalNumber(params: Record<string, unknown>, name: string): number | undefined {
  const value = params[name]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number') {
    throw new ValidationError(name, `Parameter '${name}' must be a number`)
  }
  return value
}

export function optionalBoolean(params: Record<string, unknown>, name: string): boolean | undefined {
  const value = params[name]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') {
    throw new ValidationError(name, `Parameter '${name}' must be a boolean`)
  }
  return value
}

export function requireEnum<T extends string>(
  params: Record<string, unknown>,
  name: string,
  values: T[],
): T {
  const value = requireString(params, name)
  if (!values.includes(value as T)) {
    throw new ValidationError(name, `Parameter '${name}' must be one of: ${values.join(', ')}`)
  }
  return value as T
}

export function optionalEnum<T extends string>(
  params: Record<string, unknown>,
  name: string,
  values: T[],
): T | undefined {
  const value = optionalString(params, name)
  if (value === undefined) return undefined
  if (!values.includes(value as T)) {
    throw new ValidationError(name, `Parameter '${name}' must be one of: ${values.join(', ')}`)
  }
  return value as T
}

export function optionalStringArray(params: Record<string, unknown>, name: string): string[] | undefined {
  const value = params[name]
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new ValidationError(name, `Parameter '${name}' must be an array of strings`)
  }
  return value as string[]
}
