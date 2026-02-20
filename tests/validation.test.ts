import { describe, it, expect } from 'vitest'
import { ValidationError } from '../src/errors.js'
import {
  requireParam,
  requireString,
  requireNumber,
  optionalString,
  optionalNumber,
  optionalBoolean,
  requireEnum,
  optionalEnum,
  optionalStringArray,
} from '../src/validation.js'

describe('requireParam', () => {
  it('returns the value when present', () => {
    expect(requireParam({ foo: 'bar' }, 'foo')).toBe('bar')
  })

  it('returns falsy values that are not null/undefined', () => {
    expect(requireParam({ n: 0 }, 'n')).toBe(0)
    expect(requireParam({ s: '' }, 's')).toBe('')
    expect(requireParam({ b: false }, 'b')).toBe(false)
  })

  it('throws ValidationError when param is missing', () => {
    expect(() => requireParam({}, 'id')).toThrow(ValidationError)
  })

  it('throws ValidationError when param is null', () => {
    expect(() => requireParam({ id: null }, 'id')).toThrow(ValidationError)
  })

  it('throws ValidationError when param is undefined', () => {
    expect(() => requireParam({ id: undefined }, 'id')).toThrow(ValidationError)
  })

  it('includes paramName on the error', () => {
    try {
      requireParam({}, 'project_id')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      expect((e as ValidationError).paramName).toBe('project_id')
    }
  })
})


describe('requireString', () => {
  it('returns the string value', () => {
    expect(requireString({ name: 'alice' }, 'name')).toBe('alice')
  })

  it('throws ValidationError when missing', () => {
    expect(() => requireString({}, 'name')).toThrow(ValidationError)
  })

  it('throws ValidationError when not a string', () => {
    expect(() => requireString({ name: 42 }, 'name')).toThrow(ValidationError)
  })

  it('sets paramName on type error', () => {
    try {
      requireString({ x: 123 }, 'x')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('x')
    }
  })
})

describe('requireNumber', () => {
  it('returns the number value', () => {
    expect(requireNumber({ count: 5 }, 'count')).toBe(5)
  })

  it('returns zero', () => {
    expect(requireNumber({ count: 0 }, 'count')).toBe(0)
  })

  it('throws ValidationError when missing', () => {
    expect(() => requireNumber({}, 'count')).toThrow(ValidationError)
  })

  it('throws ValidationError when not a number', () => {
    expect(() => requireNumber({ count: 'five' }, 'count')).toThrow(ValidationError)
  })

  it('sets paramName on type error', () => {
    try {
      requireNumber({ n: 'nope' }, 'n')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('n')
    }
  })
})

describe('optionalString', () => {
  it('returns the string when present', () => {
    expect(optionalString({ tag: 'v1' }, 'tag')).toBe('v1')
  })

  it('returns undefined when missing', () => {
    expect(optionalString({}, 'tag')).toBeUndefined()
  })

  it('returns undefined when null', () => {
    expect(optionalString({ tag: null }, 'tag')).toBeUndefined()
  })

  it('throws ValidationError when not a string', () => {
    expect(() => optionalString({ tag: 99 }, 'tag')).toThrow(ValidationError)
  })

  it('sets paramName on type error', () => {
    try {
      optionalString({ tag: true }, 'tag')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('tag')
    }
  })
})

describe('optionalNumber', () => {
  it('returns the number when present', () => {
    expect(optionalNumber({ level: 30 }, 'level')).toBe(30)
  })

  it('returns undefined when missing', () => {
    expect(optionalNumber({}, 'level')).toBeUndefined()
  })

  it('returns undefined when null', () => {
    expect(optionalNumber({ level: null }, 'level')).toBeUndefined()
  })

  it('throws ValidationError when not a number', () => {
    expect(() => optionalNumber({ level: 'high' }, 'level')).toThrow(ValidationError)
  })

  it('sets paramName on type error', () => {
    try {
      optionalNumber({ level: [] }, 'level')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('level')
    }
  })
})

describe('optionalBoolean', () => {
  it('returns the boolean when present', () => {
    expect(optionalBoolean({ flag: true }, 'flag')).toBe(true)
    expect(optionalBoolean({ flag: false }, 'flag')).toBe(false)
  })

  it('returns undefined when missing', () => {
    expect(optionalBoolean({}, 'flag')).toBeUndefined()
  })

  it('returns undefined when null', () => {
    expect(optionalBoolean({ flag: null }, 'flag')).toBeUndefined()
  })

  it('throws ValidationError when not a boolean', () => {
    expect(() => optionalBoolean({ flag: 'yes' }, 'flag')).toThrow(ValidationError)
  })

  it('sets paramName on type error', () => {
    try {
      optionalBoolean({ flag: 1 }, 'flag')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('flag')
    }
  })
})


describe('requireEnum', () => {
  const allowed = ['merge', 'rebase_merge', 'ff'] as const

  it('returns the value when it is in the allowed set', () => {
    expect(requireEnum({ method: 'merge' }, 'method', [...allowed])).toBe('merge')
    expect(requireEnum({ method: 'ff' }, 'method', [...allowed])).toBe('ff')
  })

  it('throws ValidationError when missing', () => {
    expect(() => requireEnum({}, 'method', [...allowed])).toThrow(ValidationError)
  })

  it('throws ValidationError when value is outside the allowed set', () => {
    expect(() => requireEnum({ method: 'squash' }, 'method', [...allowed])).toThrow(ValidationError)
  })

  it('sets paramName on invalid enum value', () => {
    try {
      requireEnum({ method: 'nope' }, 'method', [...allowed])
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('method')
    }
  })

  it('throws ValidationError when value is not a string', () => {
    expect(() => requireEnum({ method: 42 }, 'method', [...allowed])).toThrow(ValidationError)
  })
})

describe('optionalEnum', () => {
  const allowed = ['private', 'internal', 'public'] as const

  it('returns the value when it is in the allowed set', () => {
    expect(optionalEnum({ vis: 'public' }, 'vis', [...allowed])).toBe('public')
  })

  it('returns undefined when missing', () => {
    expect(optionalEnum({}, 'vis', [...allowed])).toBeUndefined()
  })

  it('returns undefined when null', () => {
    expect(optionalEnum({ vis: null }, 'vis', [...allowed])).toBeUndefined()
  })

  it('throws ValidationError when value is outside the allowed set', () => {
    expect(() => optionalEnum({ vis: 'secret' }, 'vis', [...allowed])).toThrow(ValidationError)
  })

  it('sets paramName on invalid enum value', () => {
    try {
      optionalEnum({ vis: 'secret' }, 'vis', [...allowed])
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('vis')
    }
  })
})

describe('optionalStringArray', () => {
  it('returns the array when valid', () => {
    expect(optionalStringArray({ scopes: ['api', 'read_user'] }, 'scopes')).toEqual(['api', 'read_user'])
  })

  it('returns an empty array', () => {
    expect(optionalStringArray({ scopes: [] }, 'scopes')).toEqual([])
  })

  it('returns undefined when missing', () => {
    expect(optionalStringArray({}, 'scopes')).toBeUndefined()
  })

  it('returns undefined when null', () => {
    expect(optionalStringArray({ scopes: null }, 'scopes')).toBeUndefined()
  })

  it('throws ValidationError when not an array', () => {
    expect(() => optionalStringArray({ scopes: 'api' }, 'scopes')).toThrow(ValidationError)
  })

  it('throws ValidationError when array contains non-strings', () => {
    expect(() => optionalStringArray({ scopes: ['api', 42] }, 'scopes')).toThrow(ValidationError)
  })

  it('sets paramName on invalid value', () => {
    try {
      optionalStringArray({ scopes: 123 }, 'scopes')
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as ValidationError).paramName).toBe('scopes')
    }
  })
})
