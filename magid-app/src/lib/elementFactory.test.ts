import { describe, it, expect } from 'vitest';
import { parseResponse } from './elementFactory';

const BASE = 'http://localhost:8090';

describe('parseResponse', () => {
  it('parses a menu response via "menu" trigger key', () => {
    const input = {
      menu: 'start',
      'menu-description': 'You stand at a crossroads.',
      'menu-options': [{ 'command-name': 'go-north', 'command-description': 'Go north' }],
    };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('menu');
  });

  it('parses a menu response via "menu-name" trigger key (server default)', () => {
    const input = {
      'menu-name': 'start',
      'menu-description': 'You stand at a crossroads.',
      'menu-options': [{ 'command-name': 'go-north', 'command-description': 'Go north' }],
    };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('menu');
    if (result[0].type === 'menu') {
      expect(result[0].data['menu-description']).toBe('You stand at a crossroads.');
    }
  });

  it('deduplicates when both alias keys appear in the same object', () => {
    const input = { menu: 'a', 'menu-name': 'b', 'menu-description': 'desc' };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('menu');
  });

  it('parses a narration response', () => {
    const input = { narration: 'You hear footsteps.', class: 'spooky' };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('narration');
  });

  it('parses a text response as narration', () => {
    const input = { text: 'The door opens.' };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('narration');
    if (result[0].type === 'narration') {
      expect(result[0].data.narration).toBe('The door opens.');
    }
  });

  it('parses a responses container recursively', () => {
    const input = {
      responses: [
        { narration: 'Line one.' },
        { narration: 'Line two.' },
      ],
    };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('responses');
    if (result[0].type === 'responses') {
      expect(result[0].elements).toHaveLength(2);
      expect(result[0].elements[0].type).toBe('narration');
    }
  });

  it('parses a config with css-files', () => {
    const input = {
      config: { 'css-files': 'magid://styles/main.css' },
    };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('config');
    if (result[0].type === 'config') {
      expect(result[0].data.config['css-files']).toBe(`${BASE}/styles/main.css`);
    }
  });

  it('parses a visual transition', () => {
    const input = {
      visual: 'transition',
      'transition-type': 'fade',
      'transition-length': '800',
      'transition-blocking': 'true',
    };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('visual');
    if (result[0].type === 'visual') {
      expect(result[0].data['transition-type']).toBe('fade');
    }
  });

  it('parses multiple recognized keys from one object (JFX parity)', () => {
    // The JFX client iterates ALL keys and creates one element per recognized key.
    // A single response object can carry both narration AND menu.
    const input = {
      narration: 'You enter the room.',
      class: 'plashqa',
      menu: 'main-room',
      'menu-description': 'What do you do?',
      'menu-options': [{ 'command-name': 'look', 'command-description': 'Look around' }],
    };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('narration');
    expect(result[1].type).toBe('menu');
  });

  it('ignores unknown keys', () => {
    const input = { 'unknown-key': 'some-value' };
    const result = parseResponse(input, BASE);
    expect(result).toHaveLength(0);
  });

  it('resolves magid:// anchors in string values', () => {
    const input = {
      menu: 'test',
      'menu-background-music': 'magid://audio/theme.mp3',
    };
    const result = parseResponse(input, BASE);
    expect(result[0].type).toBe('menu');
    if (result[0].type === 'menu') {
      expect(result[0].data['menu-background-music']).toBe(`${BASE}/audio/theme.mp3`);
    }
  });
});
