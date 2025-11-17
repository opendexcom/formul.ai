import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    specPattern: 'tests/e2e/**/*.cy.{js,jsx,ts,tsx}',
  },
})
