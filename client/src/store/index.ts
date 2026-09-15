import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '../types';

interface AuthState { user: AuthUser | null; booted: boolean }

const savedUser = localStorage.getItem('legalok.user');
const initialState: AuthState = { user: savedUser ? (JSON.parse(savedUser) as AuthUser) : null, booted: false };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      if (action.payload) localStorage.setItem('legalok.user', JSON.stringify(action.payload));
      else localStorage.removeItem('legalok.user');
    },
    setBooted(state) { state.booted = true; },
  },
});

export const { setUser, setBooted } = authSlice.actions;

export const store = configureStore({ reducer: { auth: authSlice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
