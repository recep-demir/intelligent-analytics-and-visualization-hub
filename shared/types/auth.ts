export type Role = 'admin' | 'analyst' | 'viewer'

export interface User {
  id:        number
  email:     string
  role:      Role
  createdAt: number
}

export interface JWTPayload {
  userId: number
  email:  string
  role:   Role
  iat:    number
  exp:    number
}

export interface LoginRequest {
  email:    string
  password: string
}

export interface LoginResponse {
  token: string
  user:  User
}

export interface CreateUserRequest {
  email:    string
  password: string
  role:     Role
}
