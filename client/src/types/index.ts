export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthContextType {
  user: User | null;
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

// Form types are now defined in formsService.ts to avoid duplication