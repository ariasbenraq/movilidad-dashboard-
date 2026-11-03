import { reviewLabels } from './review'

describe('reviewLabels', () => {
  it('returns nothing for null', () => {
    expect(reviewLabels(null)).toEqual([])
  })
  it('maps known codes and keeps unknown ones as they are', () => {
    expect(reviewLabels('unknown_district, no_amounts,new_code')).toEqual([
      'Distrito sin equivalencia',
      'Sin montos',
      'new_code',
    ])
  })
})
