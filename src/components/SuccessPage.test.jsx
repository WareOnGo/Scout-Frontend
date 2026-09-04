import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuccessPage from './SuccessPage';

const REFERENCE = 'a3f1c2de-4b56-4c78-9d01-23456789ab40';

describe('SuccessPage', () => {
  it('SUC-1: shows the numeric warehouse ID when the submission was auto-approved', () => {
    render(<SuccessPage warehouseId={1234} submissionId={REFERENCE} onStartOver={() => {}} />);
    expect(screen.getByText('Warehouse submitted')).toBeInTheDocument();
    expect(screen.getByText('Warehouse ID')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    // The staging uuid is internal — the scout has a real warehouse to quote instead.
    expect(screen.queryByText(REFERENCE)).not.toBeInTheDocument();
  });

  it('SUC-2: shows the staging reference ID and review copy when no warehouse was created', () => {
    render(<SuccessPage submissionId={REFERENCE} onStartOver={() => {}} />);
    expect(screen.getByText('Submitted for review')).toBeInTheDocument();
    expect(screen.getByText('Reference ID')).toBeInTheDocument();
    expect(screen.getByText(REFERENCE)).toBeInTheDocument();
    expect(screen.queryByText('Warehouse ID')).not.toBeInTheDocument();
  });

  it('SUC-3: renders an em-dash placeholder when neither ID is available', () => {
    render(<SuccessPage onStartOver={() => {}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('SUC-4: treats warehouseId 0 as a real ID rather than a missing one', () => {
    render(<SuccessPage warehouseId={0} submissionId={REFERENCE} onStartOver={() => {}} />);
    expect(screen.getByText('Warehouse ID')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('SUC-5: clicking the CTA invokes onStartOver', async () => {
    const onStartOver = vi.fn();
    const user = userEvent.setup();
    render(<SuccessPage warehouseId={1} onStartOver={onStartOver} />);
    await user.click(screen.getByRole('button', { name: /submit another warehouse/i }));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });
});
