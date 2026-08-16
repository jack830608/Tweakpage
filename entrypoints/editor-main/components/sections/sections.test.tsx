import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppearanceSection } from './AppearanceSection';
import { BackgroundSection } from './BackgroundSection';
import { ImageSection } from './ImageSection';
import { SizeSection } from './SizeSection';
import { SpacingSection } from './SpacingSection';
import { TypographySection } from './TypographySection';
import { EditsController } from '../../controller';

const NOW = () => '2026-08-15T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
});

test('background color records a backgroundColor edit', () => {
  document.body.innerHTML = '<div id="box" style="background-color: rgb(255, 255, 255)">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<BackgroundSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Background color hex'), { target: { value: '#112233' } });
  const record = controller.getPage().records.find((r) => r.property === 'backgroundColor')!;
  expect(record.newValue).toBe('#112233');
});

test('image url records an attr src edit once you leave the field', () => {
  document.body.innerHTML = '<img id="pic" src="/a.png">';
  const controller = new EditsController(null, document, NOW);
  render(<ImageSection element={document.getElementById('pic')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: '/b.png' } });
  fireEvent.blur(screen.getByLabelText('Image URL'));
  const record = controller.getPage().records.find((r) => r.property === 'src')!;
  expect(record.type).toBe('attr');
  expect(record.oldValue).toBe('/a.png');
  expect(record.newValue).toBe('/b.png');
  expect(document.getElementById('pic')!.getAttribute('src')).toBe('/b.png');
});

test('image section renders nothing for non-images', () => {
  document.body.innerHTML = '<p id="p">x</p>';
  const controller = new EditsController(null, document, NOW);
  const { container } = render(
    <ImageSection element={document.getElementById('p')!} controller={controller} />,
  );
  expect(container.innerHTML).toBe('');
});

test('spacing inputs record padding and margin edits in px', () => {
  document.body.innerHTML =
    '<div id="box" style="padding: 10px 10px 10px 10px; margin: 5px 5px 5px 5px">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<SpacingSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('padding top'), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText('margin left'), { target: { value: '0' } });
  const padding = controller.getPage().records.find((r) => r.property === 'paddingTop')!;
  expect(padding.oldValue).toBe('10px');
  expect(padding.newValue).toBe('24px');
  const margin = controller.getPage().records.find((r) => r.property === 'marginLeft')!;
  expect(margin.newValue).toBe('0px');
});

test('size inputs record width and height edits in px', () => {
  document.body.innerHTML = '<div id="box" style="width: 320px; height: 100px">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<SizeSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Width'), { target: { value: '480' } });
  fireEvent.change(screen.getByLabelText('Height'), { target: { value: '64' } });
  const width = controller.getPage().records.find((r) => r.property === 'width')!;
  expect(width.oldValue).toBe('320px');
  expect(width.newValue).toBe('480px');
  const height = controller.getPage().records.find((r) => r.property === 'height')!;
  expect(height.oldValue).toBe('100px');
  expect(height.newValue).toBe('64px');
});

test('transparent background shows an empty value instead of black', () => {
  document.body.innerHTML = '<div id="box">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<BackgroundSection element={document.getElementById('box')!} controller={controller} />);
  const hex = screen.getByLabelText('Background color hex') as HTMLInputElement;
  expect(hex.value).toBe('');
  expect(hex.placeholder).toBe('none');
});

test('typography alignment, letter spacing, and transform record style edits', () => {
  document.body.innerHTML =
    '<h2 id="head" style="font-size: 20px; color: rgb(0,0,0); text-align: left; letter-spacing: normal; text-transform: none">Hi</h2>';
  const controller = new EditsController(null, document, NOW);
  render(<TypographySection element={document.getElementById('head')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Text align'), { target: { value: 'center' } });
  fireEvent.change(screen.getByLabelText('Letter spacing'), { target: { value: '0.5' } });
  fireEvent.change(screen.getByLabelText('Text transform'), { target: { value: 'uppercase' } });
  const records = controller.getPage().records;
  expect(records.find((r) => r.property === 'textAlign')!.newValue).toBe('center');
  expect(records.find((r) => r.property === 'letterSpacing')!.newValue).toBe('0.5px');
  expect(records.find((r) => r.property === 'textTransform')!.newValue).toBe('uppercase');
});

test('appearance records border radius and opacity', () => {
  document.body.innerHTML = '<div id="box" style="border-radius: 0px; opacity: 1">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<AppearanceSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByRole('slider', { name: 'Corner radius' }), { target: { value: '12' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Opacity' }), { target: { value: '50' } });
  const records = controller.getPage().records;
  expect(records.find((r) => r.property === 'borderRadius')!.newValue).toBe('12px');
  expect(records.find((r) => r.property === 'opacity')!.newValue).toBe('0.5');
});

test('background image url applies as a css url value; invalid urls are refused', () => {
  document.body.innerHTML = '<div id="box">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<BackgroundSection element={document.getElementById('box')!} controller={controller} />);
  const input = screen.getByLabelText('Background image URL');
  fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
  fireEvent.blur(screen.getByLabelText('Background image URL'));
  expect(controller.getPage().records).toHaveLength(0);
  fireEvent.change(input, { target: { value: 'https://example.com/a.png' } });
  fireEvent.blur(screen.getByLabelText('Background image URL'));
  expect(controller.getPage().records.find((r) => r.property === 'backgroundImage')!.newValue).toBe(
    'url("https://example.com/a.png")',
  );
});

test('font family records a style edit and rejects unsafe values', () => {
  document.body.innerHTML =
    '<h2 id="head" style="font-size: 20px; color: rgb(0,0,0); font-family: Arial">Hi</h2>';
  const controller = new EditsController(null, document, NOW);
  render(<TypographySection element={document.getElementById('head')!} controller={controller} />);
  const input = screen.getByLabelText('Font family');
  fireEvent.change(input, { target: { value: 'Georgia; } body { display: none' } });
  expect(controller.getPage().records).toHaveLength(0);
  fireEvent.change(input, { target: { value: 'Georgia' } });
  expect(controller.getPage().records.find((r) => r.property === 'fontFamily')!.newValue).toBe('Georgia');
});

test('border width auto-adds a solid style when none, and border color records', () => {
  document.body.innerHTML = '<div id="box" style="border: 0 none rgb(0,0,0)">x</div>';
  const controller = new EditsController(null, document, NOW);
  render(<AppearanceSection element={document.getElementById('box')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Border width'), { target: { value: '2' } });
  const records = controller.getPage().records;
  expect(records.find((r) => r.property === 'borderWidth')!.newValue).toBe('2px');
  expect(records.find((r) => r.property === 'borderStyle')!.newValue).toBe('solid');
  fireEvent.change(screen.getByLabelText('Border color hex'), { target: { value: '#112233' } });
  expect(controller.getPage().records.find((r) => r.property === 'borderColor')!.newValue).toBe('#112233');
});
