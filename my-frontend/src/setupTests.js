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

console.log = (...args) => {
  // Only suppress logger output (starts with %c[)
  if (typeof args[0] === 'string' && args[0].includes('%c[')) {
    return;
  }
  originalLog(...args);
};

console.warn = (...args) => {
  // Only suppress logger output (starts with %c[)
  if (typeof args[0] === 'string' && args[0].includes('%c[')) {
    return;
  }
  originalWarn(...args);
};

console.error = (...args) => {
  // Only suppress logger output (starts with %c[)
  if (typeof args[0] === 'string' && args[0].includes('%c[')) {
    return;
  }
  originalError(...args);
};
