/**
 * Unit tests for Break Detail view.
 * Requirements: 4.1, 4.4
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BreakDetail } from '../BreakDetail';

const mockBreak = {
  id: 'break-1',
  applicationId: 'app-a',
  environment: 'production',
  severity: 'error',
  errorMessage: 'NullPointerException in UserService',
  stackTrace: 'at UserService.getUser (UserService.ts:42)',
  endpoint: '/api/users/123',
  requestPayload: { userId: '123' },
  userSession: { sessionId: 'sess-abc' },
  timestamp: '2026-03-17T10:00:00Z',
  fingerprint: 'abc123',
  status: 'new',
  firstOccurrence: '2026-03-17T09:00:00Z',
  lastOccurrence: '2026-03-17T10:00:00Z',
  occurrenceCount: 5,
  correlatedLogs: [
    {
      id: 'log-1',
      applicationId: 'app-a',
      environment: 'production',
      severity: 'error',
      message: 'User lookup failed',
      timestamp: '2026-03-17T10:00:01Z',
      tags: [],
      rawPayload: {},
    },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('BreakDetail', () => {
  it('renders all required fields for a known break', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockBreak,
    });

    render(<BreakDetail breakId="break-1" />);
    await waitFor(() => expect(screen.getByTestId('break-detail')).toBeInTheDocument());

    expect(screen.getByTestId('break-error-message')).toHaveTextContent('NullPointerException');
    expect(screen.getByTestId('break-stack-trace')).toHaveTextContent('UserService.ts:42');
    expect(screen.getByTestId('break-endpoint')).toHaveTextContent('/api/users/123');
    expect(screen.getByTestId('first-occurrence')).toBeInTheDocument();
    expect(screen.getByTestId('last-occurrence')).toBeInTheDocument();
    expect(screen.getByTestId('occurrence-count')).toHaveTextContent('5');
    expect(screen.getByTestId('break-status')).toHaveTextContent('new');
  });

  it('shows correlated log entries', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockBreak,
    });

    render(<BreakDetail breakId="break-1" />);
    await waitFor(() => expect(screen.getByTestId('correlated-logs')).toBeInTheDocument());
    expect(screen.getAllByTestId('correlated-log-entry')).toHaveLength(1);
  });

  it('shows "Data not available" placeholder for null requestPayload', async () => {
    const breakWithNulls = { ...mockBreak, requestPayload: null, userSession: null };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => breakWithNulls,
    });

    render(<BreakDetail breakId="break-1" />);
    await waitFor(() => expect(screen.getByTestId('break-detail')).toBeInTheDocument());

    expect(screen.getByTestId('request-payload-unavailable')).toHaveTextContent('Data not available');
    expect(screen.getByTestId('user-session-unavailable')).toHaveTextContent('Data not available');
  });

  it('shows not found message for 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    });

    render(<BreakDetail breakId="nonexistent" />);
    await waitFor(() => expect(screen.getByTestId('break-not-found')).toBeInTheDocument());
  });
});
