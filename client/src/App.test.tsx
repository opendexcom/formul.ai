import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders landing page', () => {
  render(<App />);
  const headingElement = screen.getByText(/AI-Powered Form Builder/i);
  expect(headingElement).toBeInTheDocument();
});
