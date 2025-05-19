# 🛠️ Troubleshooting

If you encounter issues running the application, try:

- **Restart all containers:**  
  ```bash
  docker-compose down -v
  ```
  This stops containers and removes all volumes for a clean state.

- **Check logs:**  
  ```bash
  docker-compose logs -f
  ```

- **Rebuild images:**  
  ```bash
  docker-compose up --build -d
  ```

- **Verify environment variables:**  
  Ensure your `.env` file is correctly configured and up to date.

If problems persist, open an issue on [GitHub](https://github.com/opendexcom/formul.ai/issues) with details.
