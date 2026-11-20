import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import TasksPage from './TasksPage';

// Mock the Tasks component
vi.mock('../Tasks', () => {
  return {
    default: function MockTasks({ topOffset }) {
      return <div data-testid="tasks-component">Tasks Component (topOffset: {String(topOffset)})</div>;
    },
  };
});

const mockUseOutletContext = vi.hoisted(() => vi.fn(() => ({ navHeight: 56 })));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useOutletContext: () => mockUseOutletContext(),
}));

describe('TasksPage Component', () => {
  describe('Component rendering', () => {
    test('renders Tasks component', () => {
      render(
        <MemoryRouter>
          <TasksPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('tasks-component')).toBeInTheDocument();
    });

    test('renders without crashing', () => {
      expect(() => {
        render(
          <MemoryRouter>
            <TasksPage />
          </MemoryRouter>
        );
      }).not.toThrow();
    });
  });

  describe('Component structure', () => {
    test('only renders Tasks component', () => {
      const { container } = render(
        <MemoryRouter>
          <TasksPage />
        </MemoryRouter>
      );

      expect(container.firstChild).toHaveAttribute('data-testid', 'tasks-component');
    });
  });
});
