import { fakeBrowser } from 'wxt/testing';
import { beforeEach, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BackgroundSection } from './BackgroundSection';
import { ImageSection } from './ImageSection';
import { SizeSection } from './SizeSection';
import { SpacingSection } from './SpacingSection';
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

test('image url + apply records an attr src edit', () => {
  document.body.innerHTML = '<img id="pic" src="/a.png">';
  const controller = new EditsController(null, document, NOW);
  render(<ImageSection element={document.getElementById('pic')!} controller={controller} />);
  fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: '/b.png' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
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
