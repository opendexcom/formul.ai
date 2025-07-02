import os

from jose import jwt, JWTError
from fastapi import HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv


class JwtUtils:

    def __init__(self):
        load_dotenv("../.env")
        self.PUBLIC_KEY = os.getenv('AUTH_PUBLIC_KEY')
        if self.PUBLIC_KEY is None:
            raise HTTPException(500)
        else:
            print(self.PUBLIC_KEY)

    async def verify_jwt_token(self, token: str = Security(OAuth2PasswordBearer(tokenUrl="token"))):
        try:
            payload = jwt.decode(token, self.PUBLIC_KEY, algorithms=["RS256"])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"}
            )
