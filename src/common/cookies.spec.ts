import { describe, expect, it } from 'vitest';
import { parseCookies } from './cookies';

describe('parseCookies', () => {
  it('returns an empty object when no header is present', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('parses name value pairs separated by semicolons', () => {
    expect(parseCookies('a=1; b=2; c=hello%20world')).toEqual({
      a: '1',
      b: '2',
      c: 'hello world',
    });
  });

  it('treats valueless entries as empty strings', () => {
    expect(parseCookies('flag; a=1')).toEqual({ flag: '', a: '1' });
  });
});
