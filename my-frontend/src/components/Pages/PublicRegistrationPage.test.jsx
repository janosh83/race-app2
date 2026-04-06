import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { raceApi } from '../../services/raceApi';

import PublicRegistrationPage from './PublicRegistrationPage';

vi.mock('../../services/raceApi', () => ({
  raceApi: {
    getRegistrationBySlug: vi.fn(),
    getRegistrationPaymentStatus: vi.fn(),
    createTeamPublic: vi.fn(),
    addTeamMembersPublic: vi.fn(),
    signUpTeamPublic: vi.fn(),
    createRegistrationCheckoutSession: vi.fn(),
    getTeamsPublic: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher" />,
}));

const baseRace = {
  id: 1,
  registration_slug: 'race-a',
  registration_enabled: true,
  name: 'Race A',
  description: 'Race A description',
  min_team_size: 2,
  max_team_size: 4,
  allow_team_registration: true,
  allow_individual_registration: false,
  registration_currency: 'czk',
  registration_pricing_strategy: 'team_flat',
  registration_team_amount_cents: 1000,
  registration_individual_amount_cents: 0,
  registration_driver_amount_cents: 0,
  registration_codriver_amount_cents: 0,
  categories: [{ id: 10, name: 'Main Category', description: 'Category desc' }],
  supported_languages: ['en'],
  default_language: 'en',
};

function renderPage(initialPath = '/register/race-a') {
  const router = createMemoryRouter(
    [{ path: '/register/:slug', element: <PublicRegistrationPage /> }],
    { initialEntries: [initialPath] }
  );

  const renderResult = render(<RouterProvider router={router} />);
  return { router, ...renderResult };
}

describe('PublicRegistrationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    raceApi.getRegistrationBySlug.mockResolvedValue(baseRace);
    raceApi.getRegistrationPaymentStatus.mockResolvedValue({ payment_confirmed: false });
    raceApi.createTeamPublic.mockResolvedValue({ id: 77, name: 'Team Alpha' });
    raceApi.addTeamMembersPublic.mockResolvedValue({ team_id: 77, user_ids: [1, 2] });
    raceApi.signUpTeamPublic.mockResolvedValue({});
    raceApi.createRegistrationCheckoutSession.mockResolvedValue({ checkout_url: 'https://checkout.example/session' });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        origin: 'http://localhost:3000',
        assign: vi.fn(),
      },
    });
  });

  test('loads and renders race details and team form', async () => {
    renderPage('/register/race-a');

    expect(screen.getByText('Loading registration...')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Race A' })).toBeInTheDocument();
    expect(screen.getByText('Race A description')).toBeInTheDocument();
    expect(screen.getByLabelText('Team name')).toBeInTheDocument();
    expect(screen.getByLabelText('Race category')).toBeInTheDocument();
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  test('shows unavailable card when race load fails', async () => {
    raceApi.getRegistrationBySlug.mockRejectedValueOnce(new Error('Unable to load registration details.'));

    renderPage('/register/race-a');

    expect(await screen.findByText('Registration unavailable')).toBeInTheDocument();
    expect(screen.getByText('Unable to load registration details.')).toBeInTheDocument();
  });

  test('shows payment canceled alert from checkout query params', async () => {
    renderPage('/register/race-a?checkout=cancel&team_id=42&team_name=Falcons');

    expect(await screen.findByRole('heading', { name: 'Race A' })).toBeInTheDocument();
    expect(screen.getByText('Payment not completed')).toBeInTheDocument();
    expect(screen.getByText('Review your details below and submit registration again to continue to checkout.')).toBeInTheDocument();
    expect(screen.getByText('Falcons')).toBeInTheDocument();
  });

  test('validates missing team name before submit', async () => {
    const { container } = renderPage('/register/race-a');
    await screen.findByRole('heading', { name: 'Race A' });

    // Fill member rows but keep team name empty.
    const nameInputs = container.querySelectorAll('input.form-control:not([id="team-name"]):not([type="email"])');
    const emailInputs = container.querySelectorAll('input.form-control[type="email"]');

    fireEvent.change(nameInputs[0], { target: { value: 'Member One' } });
    fireEvent.change(emailInputs[0], { target: { value: 'one@example.com' } });
    fireEvent.change(nameInputs[1], { target: { value: 'Member Two' } });
    fireEvent.change(emailInputs[1], { target: { value: 'two@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }));

    expect(screen.getByLabelText('Team name')).toBeInvalid();
    expect(raceApi.createTeamPublic).not.toHaveBeenCalled();
  });

  test('submits valid data and redirects to checkout url', async () => {
    const { container } = renderPage('/register/race-a');
    await screen.findByRole('heading', { name: 'Race A' });

    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Team Alpha' } });

    const nameInputs = container.querySelectorAll('input.form-control:not([id="team-name"]):not([type="email"])');
    const emailInputs = container.querySelectorAll('input.form-control[type="email"]');

    fireEvent.change(nameInputs[0], { target: { value: 'Member One' } });
    fireEvent.change(emailInputs[0], { target: { value: 'one@example.com' } });
    fireEvent.change(nameInputs[1], { target: { value: 'Member Two' } });
    fireEvent.change(emailInputs[1], { target: { value: 'two@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }));

    await waitFor(() => {
      expect(raceApi.createTeamPublic).toHaveBeenCalledWith('Team Alpha');
      expect(raceApi.addTeamMembersPublic).toHaveBeenCalled();
      expect(raceApi.signUpTeamPublic).toHaveBeenCalledWith(1, 77, 10);
      expect(raceApi.createRegistrationCheckoutSession).toHaveBeenCalled();
      expect(window.location.assign).toHaveBeenCalledWith('https://checkout.example/session');
    });
  });

  test('resets form state when slug changes', async () => {
    raceApi.getRegistrationBySlug.mockImplementation((slug) => {
      if (slug === 'race-b') {
        return Promise.resolve({
          ...baseRace,
          id: 2,
          registration_slug: 'race-b',
          name: 'Race B',
          categories: [{ id: 22, name: 'Category B', description: 'B' }],
        });
      }
      return Promise.resolve(baseRace);
    });

    const { router } = renderPage('/register/race-a');

    await screen.findByRole('heading', { name: 'Race A' });
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Stale Team' } });

    await act(async () => {
      await router.navigate('/register/race-b');
    });

    expect(await screen.findByRole('heading', { name: 'Race B' })).toBeInTheDocument();
    expect(screen.getByLabelText('Team name')).toHaveValue('');
  });
});
