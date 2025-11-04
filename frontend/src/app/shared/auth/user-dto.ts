export interface UserDto {
    login: string;
    password: string;
    role: 'user' | 'admin';
}
