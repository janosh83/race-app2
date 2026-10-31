import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import * as TimeContext from '../contexts/TimeContext';
import i18n from '../i18n';
import { userApi } from '../services/userApi';

import LanguageSwitcher from './LanguageSwitcher';

vi.mock('../services/userApi', () => ({
  userApi: { updatePreferredLanguage: vi.fn().mockResolvedValue({}) },
}));

describe('LanguageSwitcher', () => {
  const setSelectedLanguage = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(TimeContext, 'useTime').mockReturnValue({ setSelectedLanguage });
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  test('shows a flag button per language with the current one pressed', () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Čeština' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Čeština' }).querySelector('img')).toHaveAttribute('alt', '');
  });

  test('switches the language with one tap and saves it for a logged-in user', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 7 }));
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Čeština' }));

    expect(i18n.language).toBe('cs');
    expect(setSelectedLanguage).toHaveBeenCalledWith('cs');
    await vi.waitFor(() => expect(userApi.updatePreferredLanguage).toHaveBeenCalledWith(7, 'cs'));
  });

  test('does nothing when the current language is tapped', () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(setSelectedLanguage).not.toHaveBeenCalled();
  });

  test('uses the dark style for the top bars', () => {
    render(<LanguageSwitcher variant="dark" />);

    expect(screen.getByRole('group', { name: 'Language' })).toHaveClass('language-switcher-dark');
  });
});
