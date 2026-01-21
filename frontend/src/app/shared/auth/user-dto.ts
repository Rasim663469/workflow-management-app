export interface UserDto {
  id?: number;
  login: string;
  role: 'super_admin' | 'super_organisateur' | 'organisateur' | 'benevole';
}
