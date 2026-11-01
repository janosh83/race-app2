import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import TranslationManager from './TranslationManager';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    getRaceTranslations: vi.fn(),
    createRaceTranslation: vi.fn(),
    updateRaceTranslation: vi.fn(),
    deleteRaceTranslation: vi.fn(),
  },
}));

describe('TranslationManager', () => {
  beforeEach(() => {
    adminApi.getRaceTranslations.mockResolvedValue([]);
    adminApi.createRaceTranslation.mockResolvedValue({});
  });

  it('sends the place names with the race translation, showing the originals as placeholders', async () => {
    render(
      <TranslationManager
        entityType="race"
        entityId={1}
        entityName="City Race"
        fields={{ name: 'Name', finish_description: 'Finish name' }}
        placeholders={{ name: 'City Race', finish_description: 'Pub' }}
        supportedLanguages={['en', 'cs']}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Čeština|Czech|cs/i }));
    const finish = screen.getByLabelText('Finish name');
    expect(finish).toHaveAttribute('placeholder', 'Pub');
    fireEvent.change(finish, { target: { value: 'Hospoda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(adminApi.createRaceTranslation).toHaveBeenCalledWith(
      1, 'cs', expect.objectContaining({ finish_description: 'Hospoda' }),
    ));
  });
});
