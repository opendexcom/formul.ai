describe('Homepage', () => {
  it('loads correctly', () => {
    cy.visit('http://localhost:5173')
    cy.contains('Welcome').should('be.visible')
  })
})
