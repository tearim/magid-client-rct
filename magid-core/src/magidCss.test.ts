import { describe, it, expect } from 'vitest';
import { parseMagidCss } from './magidCss';

describe('parseMagidCss', () => {
  it('camel-cases properties', () => {
    expect(parseMagidCss('font-size: 12px; color:red')).toEqual({ fontSize: '12px', color: 'red' });
  });

  it('gives unit-less positions px and makes the element absolute', () => {
    expect(parseMagidCss('left: 10; top: 5%')).toEqual({ left: '10px', top: '5%', position: 'absolute' });
  });

  it('places the element with -mg-abs-x / -mg-abs-y like left / top', () => {
    expect(parseMagidCss('-mg-abs-x: -20; -mg-abs-y: 30%'))
      .toEqual({ left: '-20px', top: '30%', position: 'absolute' });
  });

  it('lets -mg-abs-x / -mg-abs-y win over left / top in any order', () => {
    expect(parseMagidCss('-mg-abs-x: 100; left: 5; top: 1; -mg-abs-y: 2px'))
      .toEqual({ left: '100px', top: '2px', position: 'absolute' });
  });

  it('keeps the other properties of a story declaration (wahlprogramm 1st_choice.xml)', () => {
    expect(parseMagidCss('-mg-abs-x: -20; top: 5; -fx-dont: true;'))
      .toEqual({ left: '-20px', top: '5px', position: 'absolute' });
  });

  it('drops window-level -mg-* and JavaFX -fx-* properties', () => {
    expect(parseMagidCss('-mg-screen: fullscreen; -mg-window-width: 800; -mg-resizable: false; -fx-fill: red; color: blue'))
      .toEqual({ color: 'blue' });
  });
});
