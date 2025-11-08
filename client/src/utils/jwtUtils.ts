interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat: number; // Issued at
  exp: number; // Expires at
}

export const decodeJwt = (token: string): JwtPayload | null => {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    
    // Add padding if needed (JWT base64 encoding might not have padding)
    const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    
    // Decode from base64
    const decodedPayload = atob(paddedPayload);
    
    // Parse JSON
    return JSON.parse(decodedPayload) as JwtPayload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export const getUserIdFromToken = (token: string): string | null => {
  const payload = decodeJwt(token);
  return payload ? payload.sub : null;
};

export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwt(token);
  if (!payload) {
    return true;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
};