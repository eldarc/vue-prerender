import truth from '../src/extract'

describe('#truth', () => {
  it('should be truthy', () => {
    expect(truth()).toBeTruthy()
  })
})
