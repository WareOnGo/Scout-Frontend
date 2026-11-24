import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeasurementField, VentilationField } from './StructuredFields';
import { serializeVentilation } from '../utils/formFields';

function Form({ initial = '' }) {
  const [value, setValue] = useState(initial);
  return <><VentilationField value={value} onChange={setValue} /><output aria-label="Saved ventilation">{serializeVentilation(value)}</output><button>Outside</button></>;
}

function Measurement({ field = 'clearHeightFt', initial = '' }) {
  const [value, setValue] = useState(initial);
  return <MeasurementField field={field} value={value} onChange={setValue} />;
}

describe('floor load to be confirmed', () => {
  it('supports keyboard toggling and restores the entered capacity', async () => {
    const user = userEvent.setup();
    render(<Measurement field="floorStrengthPerSqm" initial="5.5 tonnes/sq m" />);
    const checkbox = screen.getByRole('checkbox', { name: 'To be confirmed' });
    checkbox.focus();
    await user.keyboard(' ');
    expect(checkbox).toBeChecked();
    expect(screen.getByLabelText('Floor Strength value')).toBeDisabled();
    await user.keyboard(' ');
    expect(screen.getByLabelText('Floor Strength value')).toBeEnabled();
    expect(screen.getByLabelText('Floor Strength value')).toHaveValue('5.5');
  });
  it('reopens a saved confirmation checked and supports restoring the original answer', () => {
    render(<Measurement field="floorStrengthPerSqm" initial="To be confirmed" />);
    const checkbox = screen.getByRole('checkbox', { name: 'To be confirmed' });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(screen.getByLabelText('Floor Strength value')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Keep original value' }));
    expect(checkbox).toBeChecked();
  });
  it('stays disabled inside a protected form section', async () => {
    const user = userEvent.setup();
    render(<fieldset disabled><Measurement field="floorStrengthPerSqm" initial="5 tonnes/sq m" /></fieldset>);
    const checkbox = screen.getByRole('checkbox', { name: 'To be confirmed' });
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});

describe('power as per requirement', () => {
  it('supports keyboard toggling and restores the entered magnitude and unit', async () => {
    const user = userEvent.setup();
    render(<Measurement field="powerKva" initial="125 HP" />);
    const checkbox = screen.getByRole('checkbox', { name: 'As per requirement' });
    checkbox.focus();
    await user.keyboard(' ');
    expect(checkbox).toBeChecked();
    expect(screen.getByLabelText('Power value')).toBeDisabled();
    expect(screen.getByLabelText('Power unit')).toBeDisabled();
    await user.keyboard(' ');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByLabelText('Power value')).toBeEnabled();
    expect(screen.getByLabelText('Power value')).toHaveValue('125');
    expect(screen.getByLabelText('Power unit')).toHaveValue('HP');
  });
  it('reopens saved requirements checked and allows restoring the original after unticking', () => {
    render(<Measurement field="powerKva" initial="As per requirement" />);
    const checkbox = screen.getByRole('checkbox', { name: 'As per requirement' });
    expect(checkbox).toBeChecked();
    expect(screen.getByLabelText('Power value')).toBeDisabled();
    fireEvent.click(checkbox);
    expect(screen.getByLabelText('Power value')).toBeEnabled();
    expect(screen.getByLabelText('Power value')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Keep original value' }));
    expect(checkbox).toBeChecked();
  });
  it('hides numeric warnings only while the power inputs are disabled', () => {
    render(<Measurement field="powerKva" />);
    fireEvent.change(screen.getByLabelText('Power value'), { target: { value: '50x' } });
    expect(screen.getByRole('alert')).toBeVisible();
    const checkbox = screen.getByRole('checkbox', { name: 'As per requirement' });
    fireEvent.click(checkbox);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Power value')).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(checkbox);
    expect(screen.getByLabelText('Power value')).toHaveValue('50x');
    expect(screen.getByRole('alert')).toBeVisible();
  });
  it('preserves a legacy description after the checkbox is unticked', () => {
    render(<Measurement field="powerKva" initial="Available on request" />);
    const checkbox = screen.getByRole('checkbox', { name: 'As per requirement' });
    fireEvent.click(checkbox);
    expect(screen.getByLabelText('Power value')).toBeDisabled();
    fireEvent.click(checkbox);
    expect(screen.getByText('Available on request')).toBeVisible();
  });
  it('does not add this option to other measurements', () => {
    render(<Measurement field="clearHeightFt" />);
    expect(screen.queryByRole('checkbox', { name: 'As per requirement' })).toBeNull();
  });
});

describe('retired area units', () => {
  it.each([['builtup_area', 'Built-up Area'], ['carpet_area', 'Carpet Area'], ['land_parcel_size', 'Land Parcel Size']])(
    'preserves %s in square metres until explicitly replaced', (field, label) => {
      render(<Measurement field={field} initial="120 sqm" />);
      expect(screen.getByText('120 sqm')).toBeVisible();
      expect(screen.queryByLabelText(`${label} value`)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Replace value' }));
      expect(screen.getByLabelText(`${label} value`)).toHaveValue('');
      expect(screen.queryByRole('option', { name: 'sq m', exact: true })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Keep original value' }));
      expect(screen.getByText('120 sqm')).toBeVisible();
    },
  );
  it('does not label a saved square-metre draft as square feet', () => {
    render(<Measurement field="builtup_area" initial={{ kind: 'measurement', raw: '', parts: ['120.5'], unit: 'sq m', edited: true, legacy: false }} />);
    expect(screen.getByText('120.5 sq m')).toBeVisible();
    expect(screen.queryByText('sq ft', { exact: true })).toBeNull();
  });
  it('requires an explicit unit for a previously unitless area', () => {
    render(<Measurement field="builtup_area" initial="120" />);
    expect(screen.getByLabelText('Built-up Area value')).toHaveValue('120');
    expect(screen.getByLabelText('Built-up Area unit')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Built-up Area unit'), { target: { value: 'sq ft' } });
    expect(screen.getByText('sq ft', { exact: true })).toBeVisible();
    expect(screen.getByLabelText('Built-up Area value')).toHaveValue('120');
  });
});

describe('immediate measurement feedback', () => {
  it('warns while typing and clears the warning as soon as the character is corrected', async () => {
    const user = userEvent.setup();
    render(<Measurement />);
    const input = screen.getByLabelText('Clear Height value');
    await user.type(input, '50x');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('50x');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Use digits and at most one decimal point (e.g. 50.5).');
    expect(screen.getByRole('alert')).toBeVisible();
    await user.keyboard('{Backspace}.5');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('50.5');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['50 feet', '1,000', '1e3', '-5', '+5', '1.2.3', '4/2'])('warns on pasted %s without discarding the input', async text => {
    const user = userEvent.setup();
    render(<Measurement field="floorStrengthPerSqm" />);
    const input = screen.getByLabelText('Floor Strength value');
    await user.click(input);
    await user.paste(text);
    expect(input).toHaveFocus();
    expect(input).toHaveValue(text);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeVisible();
    await user.clear(input);
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('allows decimal entry in progress without premature character warnings', () => {
    render(<Measurement />);
    const input = screen.getByLabelText('Clear Height value');
    for (const value of ['.', '.5', '50.', '50.5', '0', ' 50.5 ', '']) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value);
      expect(input).toHaveAttribute('aria-invalid', 'false');
      expect(screen.queryByRole('alert')).toBeNull();
    }
  });

  it('marks only the dimension with invalid characters while the other dimensions are still being entered', async () => {
    const user = userEvent.setup();
    render(<Measurement field="dimensions" />);
    const length = screen.getByLabelText('Dimensions length');
    const width = screen.getByLabelText('Dimensions width');
    const height = screen.getByLabelText('Dimensions height');
    await user.type(length, '100');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.type(width, '20m');
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(length).toHaveAttribute('aria-invalid', 'false');
    expect(height).toHaveAttribute('aria-invalid', 'false');
    await user.keyboard('{Backspace}');
    expect(width).toHaveValue('20');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('preserves legacy descriptions until replaced and clears feedback when the original is restored', async () => {
    const user = userEvent.setup();
    render(<Measurement initial="20–25 feet" />);
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Replace value' }));
    await user.type(screen.getByLabelText('Clear Height value'), '20ft');
    expect(screen.getByRole('alert')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Keep original value' }));
    expect(screen.getByText('20–25 feet')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ventilation multiselect dropdown', () => {
  it('collapses the options and saves multiple selections with exclusive None/Not Known', async () => {
    const user = userEvent.setup();
    render(<Form />);
    const trigger = screen.getByLabelText('Ventilation Type options');
    expect(trigger.closest('details')).not.toHaveAttribute('open');
    await user.click(trigger);
    await user.click(screen.getByRole('checkbox', { name: 'Ridge', exact: true }));
    await user.click(screen.getByRole('checkbox', { name: 'Turbo', exact: true }));
    expect(trigger).toHaveTextContent('Ridge, Turbo');
    expect(screen.getByLabelText('Saved ventilation')).toHaveTextContent('Ridge, Turbo');
    await user.click(screen.getByRole('checkbox', { name: 'None', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Ridge', exact: true })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Turbo', exact: true })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Not Known', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'None', exact: true })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Window', exact: true }));
    expect(screen.getByRole('checkbox', { name: 'Not Known', exact: true })).not.toBeChecked();
    expect(screen.getByLabelText('Saved ventilation')).toHaveTextContent(/^Window$/);
  });

  it('closes on Escape and outside taps without losing selections', async () => {
    const user = userEvent.setup();
    render(<Form initial="Ridge, Turbo" />);
    const trigger = screen.getByLabelText('Ventilation Type options');
    await user.click(trigger);
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Ridge', exact: true }), { key: 'Escape' });
    expect(trigger.closest('details')).not.toHaveAttribute('open');
    expect(trigger).toHaveFocus();
    expect(fireEvent.keyDown(trigger, { key: 'Escape' })).toBe(true);
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(trigger.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Saved ventilation')).toHaveTextContent('Ridge, Turbo');
  });

  it('preserves a legacy description until explicitly replaced', async () => {
    const user = userEvent.setup();
    render(<Form initial="Cross ventilation with fans" />);
    expect(screen.queryByLabelText('Ventilation Type options')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Replace value' }));
    await user.click(screen.getByLabelText('Ventilation Type options'));
    await user.click(screen.getByRole('checkbox', { name: 'Ridge', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Keep original value' }));
    expect(screen.getByLabelText('Saved ventilation')).toHaveTextContent('Cross ventilation with fans');
  });
});
