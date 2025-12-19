/**
 * Redux Store Configuration
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import urlReducer from './slices/urlSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    urls: urlReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
