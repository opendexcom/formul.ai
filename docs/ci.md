# 🤖 Continuous Integration (CI)

This project uses GitHub Actions for CI.  
On every pull request, the following checks are automatically run depending on which files are changed:

- **Frontend:**  
  - Linting (`npm run lint`) if files in `frontend/` are changed  
  - End-to-end tests (`npm run test:e2e`) always run

- **Processing Service:**  
  - Dependency sync, linting (ruff), and tests (pytest) if files in `processing/` are changed

- **Survey Service:**  
  - Linting (Checkstyle) and tests (Maven) if files in `survey/` are changed

See workflow config in `.github/workflows/formulaai-ci.yml`.
