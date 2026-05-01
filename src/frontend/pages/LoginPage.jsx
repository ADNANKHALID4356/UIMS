import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, clearError } from '../store/slices/authSlice';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const { industryConfig } = useAppSelector((state) => state.organization);

  const handleLogin = async (e) => {
    e.preventDefault();
    dispatch(clearError());

    if (!username || !password) {
      return;
    }

    const result = await dispatch(loginUser({ username, password }));
    if (result.payload) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-primary to-secondary p-5">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{industryConfig?.displayName || 'Enterprise Inventory System'}</h1>
          <p className="text-gray-600">Login to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block mb-2 text-gray-800 font-medium">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={isLoading}
              required
              className="w-full py-3 px-4 border border-gray-300 rounded-md text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-2 text-gray-800 font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
              required
              className="w-full py-3 px-4 border border-gray-300 rounded-md text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-md text-base font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-8 text-center pt-5 border-t border-gray-200">
          <p className="text-gray-500 text-xs">
            Password must have: 8+ characters, uppercase, lowercase, and number
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
