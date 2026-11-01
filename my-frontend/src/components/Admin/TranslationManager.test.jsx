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

  it("does not offer the race's own language as a translation", async () => {
    render(
      <TranslationManager entityType="race" entityId={1} entityName="City Race" supportedLanguages={['en', 'cs', 'de']} defaultLanguage="en" />,
    );

    expect(await screen.findByRole('button', { name: '+ Čeština' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Deutsch' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ English' })).not.toBeInTheDocument();
    expect(screen.getByText(/original texts are in English/)).toBeInTheDocument();
  });

  it('deletes a translation after confirming in the row', async () => {
    adminApi.getRaceTranslations.mockResolvedValue([{ language: 'cs', name: 'Městský závod' }]);
    adminApi.deleteRaceTranslation.mockResolvedValue({});
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<TranslationManager entityType="race" entityId={1} entityName="City Race" supportedLanguages={['en', 'cs']} defaultLanguage="en" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(adminApi.deleteRaceTranslation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(adminApi.deleteRaceTranslation).toHaveBeenCalledWith(1, 'cs'));
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
