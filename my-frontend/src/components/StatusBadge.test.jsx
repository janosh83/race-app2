import { render, screen } from '@testing-library/react';
import React from 'react';

import StatusBadge from './StatusBadge';

describe('StatusBadge Component', () => {
  const mockTimeInfo = {
    state: 'SHOW_ONLY',
    startShow: new Date('2025-01-20T10:00:00'),
    endShow: new Date('2025-01-20T15:00:00'),
  };

  describe('Logging Status', () => {
    it('displays "Logging open" when logging is allowed and content is shown', () => {
      render(
        <StatusBadge
          isShown={true}
          loggingAllowed={true}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      expect(screen.getByText('Logging open')).toBeInTheDocument();
    });

    it('displays "Read-only" when logging is not allowed but content is shown', () => {
      render(
        <StatusBadge
          isShown={true}
          loggingAllowed={false}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });

    it('applies bg-success class when logging is allowed', () => {
      const { container } = render(
        <StatusBadge
          isShown={true}
          loggingAllowed={true}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('bg-success');
    });

    it('applies bg-secondary class when logging is not allowed', () => {
      const { container } = render(
        <StatusBadge
          isShown={true}
          loggingAllowed={false}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('bg-secondary');
    });
  });

  describe('Content Hidden Status', () => {
    it('displays "Coming [date]" when content is not shown and in BEFORE_SHOW state', () => {
      const beforeShowTimeInfo = {
        ...mockTimeInfo,
        state: 'BEFORE_SHOW',
        startShow: new Date('2025-01-20T10:00:00'),
      };
      render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={beforeShowTimeInfo}
          itemName="Checkpoints"
        />
      );
      expect(screen.getByText(/Coming/)).toBeInTheDocument();
    });

    it('displays "Checkpoints hidden" when content is not shown and in AFTER_SHOW state', () => {
      const afterShowTimeInfo = {
        ...mockTimeInfo,
        state: 'AFTER_SHOW',
      };
      render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={afterShowTimeInfo}
          itemName="Checkpoints"
        />
      );
      expect(screen.getByText('Checkpoints hidden')).toBeInTheDocument();
    });

    it('displays "Tasks hidden" when content is not shown and item name is Tasks', () => {
      const afterShowTimeInfo = {
        ...mockTimeInfo,
        state: 'AFTER_SHOW',
      };
      render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={afterShowTimeInfo}
          itemName="Tasks"
        />
      );
      expect(screen.getByText('Tasks hidden')).toBeInTheDocument();
    });

    it('applies bg-warning class when content is not shown', () => {
      const { container } = render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      const badge = container.querySelector('.badge');
      expect(badge).toHaveClass('bg-warning');
    });
  });

  describe('Custom Item Name', () => {
    it('uses custom itemName in hidden message', () => {
      const afterShowTimeInfo = {
        ...mockTimeInfo,
        state: 'AFTER_SHOW',
      };
      render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={afterShowTimeInfo}
          itemName="Custom Items"
        />
      );
      expect(screen.getByText('Custom Items hidden')).toBeInTheDocument();
    });

    it('defaults to "Content" when itemName is not provided', () => {
      const afterShowTimeInfo = {
        ...mockTimeInfo,
        state: 'AFTER_SHOW',
      };
      render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={afterShowTimeInfo}
        />
      );
      expect(screen.getByText('Content hidden')).toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    it('applies correct fixed positioning with default topOffset', () => {
      const { container } = render(
        <StatusBadge
          isShown={true}
          loggingAllowed={true}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      const div = container.querySelector('div');
      expect(div).toHaveStyle({
        position: 'fixed',
        top: '64px',
        right: '16px',
        zIndex: '1500',
      });
    });

    it('applies correct fixed positioning with custom topOffset', () => {
      const { container } = render(
        <StatusBadge
          topOffset={80}
          isShown={true}
          loggingAllowed={true}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      const div = container.querySelector('div');
      expect(div).toHaveStyle({
        position: 'fixed',
        top: '88px',
        right: '16px',
        zIndex: '1500',
      });
    });

    it('uses 16px top when topOffset is 0', () => {
      const { container } = render(
        <StatusBadge
          topOffset={0}
          isShown={true}
          loggingAllowed={true}
          timeInfo={mockTimeInfo}
          itemName="Checkpoints"
        />
      );
      const div = container.querySelector('div');
      expect(div).toHaveStyle({
        top: '16px',
      });
    });
  });

  describe('UNKNOWN State', () => {
    it('displays hidden message when state is UNKNOWN and content is not shown', () => {
      const unknownTimeInfo = {
        ...mockTimeInfo,
        state: 'UNKNOWN',
      };
      render(
        <StatusBadge
          isShown={false}
          loggingAllowed={false}
          timeInfo={unknownTimeInfo}
          itemName="Checkpoints"
        />
      );
      expect(screen.getByText('Checkpoints hidden')).toBeInTheDocument();
    });
  });
});
