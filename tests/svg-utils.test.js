const assert = require('assert');
const SVGUtils = require('../lib/svg-utils');

describe('SVGUtils', () => {
  describe('pathLength', () => {
    it('should calculate length of straight line', () => {
      const length = SVGUtils.pathLength('M0,0 L100,0');
      assert.strictEqual(length, 100);
    });

    it('should calculate length of diagonal', () => {
      const length = SVGUtils.pathLength('M0,0 L100,100');
      assert.ok(Math.abs(length - 141.42) < 0.1);
    });
  });

  describe('parseTransform', () => {
    it('should parse translate', () => {
      const t = SVGUtils.parseTransform('translate(10, 20)');
      assert.strictEqual(t.x, 10);
      assert.strictEqual(t.y, 20);
    });

    it('should parse scale', () => {
      const s = SVGUtils.parseTransform('scale(2)');
      assert.strictEqual(s.scaleX, 2);
      assert.strictEqual(s.scaleY, 2);
    });
  });

  describe('convertToRelative', () => {
    it('should convert absolute to relative', () => {
      const rel = SVGUtils.convertToRelative('M100,100 L200,200');
      assert.ok(rel.includes('l'));
    });
  });
});
