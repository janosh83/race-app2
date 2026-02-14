import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from './TasksPage';

// Mock the Tasks component
vi.mock('../Tasks', () => {
  return function MockTasks() {
    return <div data-testid="tasks-component">Tasks Component</div>;
  };
});

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
