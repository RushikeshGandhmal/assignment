import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the app title', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /salary management/i })).toBeInTheDocument();
  });

  it('renders a call-to-action button', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });
});
