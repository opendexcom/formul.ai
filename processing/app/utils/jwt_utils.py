import os

from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi import Security
from fastapi import status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from jose import jwt


class JwtUtils:

    def __init__(self):
        load_dotenv("../.env")
        self.PUBLIC_KEY = os.getenv('AUTH_PUBLIC_KEY')
        self.PRIVATE_KEY = os.getenv('AUTH_PRIVATE_KEY')
        if self.PUBLIC_KEY is None:
            raise HTTPException(500)
        else:
            self.PUBLIC_KEY = self.PUBLIC_KEY.replace('\\n', '\n')
            self.PRIVATE_KEY = self.PRIVATE_KEY.replace('\\n', '\n')

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

    def generate_jwt_token(self):
        return jwt.encode({"name": "test"}, self.PRIVATE_KEY, algorithm="RS256")
