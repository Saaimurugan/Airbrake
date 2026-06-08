/**
 * Unit tests for role-gated UI components.
 * Requirements: 6.3, 6.4, 6.5
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AlertManagement } from '../AlertManagement';
import { Settings } from '../../settings/Settings';

// DB-shaped mock data (matches mapRule field names)
const mockRules = [
  {
    id: 'rule-1',
    rule_name: 'High Error Rate',
    project_name: 'Test Project',
    alert_type: 'High Failure',
    threshold: 10,
    window_minutes: 1,
    is_active: true,
  },
];

const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'admin',
    oauthProvider: 'google',
    oauthSubject: 'sub-1',
    createdAt: new Date().toISOString(),
  },
];

const mockRetention = { applicationId: 'app-a', retentionDays: 30 };

// Helper: mock fetch — returns rules for /alert-rules, empty for everything else
function mockFetchForAlerts() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('alert-rules')) {
      return Promise.resolve({ ok: true, json: async () => mockRules });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('AlertManagement — role gating', () => {
  // AlertManagement makes 3 concurrent fetch calls on mount:
  //   /api/alert-rules, /api/alert-history, /api/projects
  // We use URL-based mocking so order doesn't matter.

  it('renders for admin role and shows rules after load', async () => {
    mockFetchForAlerts();
    render(<AlertManagement role="admin" />);
    await waitFor(() =>
      expect(screen.getByText('High Error Rate')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('alert-management')).toBeInTheDocument();
  });

  it('renders for developer role', async () => {
    mockFetchForAlerts();
    render(<AlertManagement role="developer" />);
    await waitFor(() =>
      expect(screen.getByText('High Error Rate')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('alert-management')).toBeInTheDocument();
  });

  it('renders for viewer role (read-only)', async () => {
    mockFetchForAlerts();
    render(<AlertManagement role="viewer" />);
    // Component always renders for all roles
    await waitFor(() =>
      expect(screen.getByTestId('alert-management')).toBeInTheDocument(),
    );
  });

  it('renders alert rule items after data loads', async () => {
    mockFetchForAlerts();
    render(<AlertManagement role="admin" />);
    await waitFor(() =>
      expect(screen.getByText('High Error Rate')).toBeInTheDocument(),
    );
    expect(screen.getByText('High Error Rate')).toBeInTheDocument();
  });
});

describe('Settings — role gating', () => {
  // Settings makes 2 fetch calls on mount: /api/users and /api/retention

  function mockFetchForSettings() {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('users')) {
        return Promise.resolve({ ok: true, json: async () => mockUsers });
      }
      return Promise.resolve({ ok: true, json: async () => mockRetention });
    });
  }

  it('renders for admin role', async () => {
    mockFetchForSettings();
    render(<Settings role="admin" />);
    await waitFor(() =>
      expect(screen.getByTestId('user-management')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('retention-settings')).toBeInTheDocument();
  });

  it('is hidden for developer role', () => {
    render(<Settings role="developer" />);
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
  });

  it('is hidden for viewer role', () => {
    render(<Settings role="viewer" />);
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
  });

  it('renders user rows', async () => {
    mockFetchForSettings();
    render(<Settings role="admin" />);
    await waitFor(() =>
      expect(screen.getByTestId('user-row')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('user-email')).toHaveTextContent('admin@example.com');
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
  });
});
