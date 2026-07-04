import {
  getRatingBounds,
  reverseCodeDistribution,
  reverseCodeValue,
} from './reverse-code.util';

describe('reverseCodeValue', () => {
  it('flips values within a 1-5 scale', () => {
    expect(reverseCodeValue(1, 1, 5)).toBe(5);
    expect(reverseCodeValue(5, 1, 5)).toBe(1);
    expect(reverseCodeValue(3, 1, 5)).toBe(3);
  });
});

describe('reverseCodeDistribution', () => {
  it('flips distribution keys for rating scale', () => {
    const result = reverseCodeDistribution({ '1': 2, '5': 3 }, 1, 5);
    expect(result).toEqual({ '5': 2, '1': 3 });
  });
});

describe('getRatingBounds', () => {
  it('reads min/max from validation', () => {
    expect(
      getRatingBounds({
        min: { value: 0 },
        max: { value: 10 },
      }),
    ).toEqual({ min: 0, max: 10 });
  });

  it('defaults to 1-5', () => {
    expect(getRatingBounds()).toEqual({ min: 1, max: 5 });
  });
});
