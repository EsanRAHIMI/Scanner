export interface AuthMe {
  email: string;
  username: string;
  is_admin: boolean;
  permissions: string[];
}
