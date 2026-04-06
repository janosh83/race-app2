import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import TasksPage from './TasksPage';

// Mock the Tasks component
vi.mock('../Tasks', () => {
  return {
    default: function MockTasks() {
      return <div data-testid="tasks-component">Tasks Component</div>;
    },
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
  });
});
