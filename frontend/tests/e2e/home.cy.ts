describe('Homepage', () => {
  it('loads correctly', () => {
    cy.visit('http://localhost')
    cy.contains('Welcome').should('be.visible')
  })
})
