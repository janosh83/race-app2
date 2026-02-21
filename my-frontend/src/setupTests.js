/* eslint-disable no-console */
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import './i18n';

// Suppress logger console output in tests
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (..._args) => {
  // Only suppress logger output (starts with %c[)
  if (typeof _args[0] === 'string' && _args[0].includes('%c[')) {
    return;
  }
  originalLog(..._args);
};

console.warn = (..._args) => {
  // Only suppress logger output (starts with %c[)
  if (typeof _args[0] === 'string' && _args[0].includes('%c[')) {
    return;
  }
  originalWarn(..._args);
};

console.error = (..._args) => {
  // Only suppress logger output (starts with %c[)
  if (typeof _args[0] === 'string' && _args[0].includes('%c[')) {
    return;
  }
  originalError(..._args);
};
