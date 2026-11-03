import { distritoError } from './validate'

describe('distritoError', () => {
  it('rejects empty and blank text', () => {
    expect(distritoError('')).not.toBeNull()
    expect(distritoError('   ')).not.toBeNull()
  })
  it('rejects more than 100 characters', () => {
    expect(distritoError('a'.repeat(101))).not.toBeNull()
  })
  it('accepts a normal district', () => {
    expect(distritoError('Jesús María')).toBeNull()
  })
})
