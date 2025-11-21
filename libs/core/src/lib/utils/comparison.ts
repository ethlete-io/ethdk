/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-var */

/**
 * Stolen from klona to avoid adding a dependency
 * https://github.com/lukeed/klona
 *
 * MIT License
 *
 * Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const set = (obj: any, key: any, val: any) => {
  if (typeof val.value === 'object') val.value = clone(val.value);
  if (!val.enumerable || val.get || val.set || !val.configurable || !val.writable || key === '__proto__') {
    Object.defineProperty(obj, key, val);
  } else obj[key] = val.value;
};

export const clone = <T>(original: T): T => {
  if (typeof original !== 'object') return original;

  var _og = original as any;

  var i = 0,
    k,
    list,
    tmp: any,
    str = Object.prototype.toString.call(_og);

  if (str === '[object Object]') {
    tmp = Object.create(_og.__proto__ || null);
  } else if (str === '[object Array]') {
    tmp = Array(_og.length);
  } else if (str === '[object Set]') {
    tmp = new Set();
    _og.forEach(function (val: any) {
      tmp.add(clone(val));
    });
  } else if (str === '[object Map]') {
    tmp = new Map();
    _og.forEach(function (val: any, key: any) {
      tmp.set(clone(key), clone(val));
    });
  } else if (str === '[object Date]') {
    tmp = new Date(+_og);
  } else if (str === '[object RegExp]') {
    tmp = new RegExp(_og.source, _og.flags);
  } else if (str === '[object DataView]') {
    tmp = new _og.constructor(clone(_og.buffer));
  } else if (str === '[object ArrayBuffer]') {
    tmp = _og.slice(0);
  } else if (str.slice(-6) === 'Array]') {
    // ArrayBuffer.isView(x)
    // ~> `new` bcuz `Buffer.slice` => ref
    tmp = new _og.constructor(_og);
  }

  if (tmp) {
    for (list = Object.getOwnPropertySymbols(_og); i < list.length; i++) {
      set(tmp, list[i], Object.getOwnPropertyDescriptor(_og, list[i]!));
    }

    for (i = 0, list = Object.getOwnPropertyNames(_og); i < list.length; i++) {
      if (Object.hasOwnProperty.call(tmp, (k = list[i]!)) && tmp[k] === _og[k]) continue;
      set(tmp, k, Object.getOwnPropertyDescriptor(_og, k));
    }
  }

  return tmp || _og;
};

/**
 * Stolen from dequal to avoid adding a dependency
 * https://github.com/lukeed/dequal
 *
 * The MIT License (MIT)
 *
 * Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const has = Object.prototype.hasOwnProperty;

function find(iter: any, tar: any, key?: any) {
  for (key of iter.keys()) {
    if (equal(key, tar)) return key;
  }
}

export const equal = (foo: any, bar: any) => {
  var ctor: any, len: any, tmp: any;
  if (foo === bar) return true;

  if (foo && bar && (ctor = foo.constructor) === bar.constructor) {
    if (ctor === Date) return foo.getTime() === bar.getTime();
    if (ctor === RegExp) return foo.toString() === bar.toString();

    if (ctor === Array) {
      if ((len = foo.length) === bar.length) {
        while (len-- && equal(foo[len], bar[len]));
      }
      return len === -1;
    }

    if (ctor === Set) {
      if (foo.size !== bar.size) {
        return false;
      }
      for (len of foo) {
        tmp = len;
        if (tmp && typeof tmp === 'object') {
          tmp = find(bar, tmp);
          if (!tmp) return false;
        }
        if (!bar.has(tmp)) return false;
      }
      return true;
    }

    if (ctor === Map) {
      if (foo.size !== bar.size) {
        return false;
      }
      for (len of foo) {
        tmp = len[0];
        if (tmp && typeof tmp === 'object') {
          tmp = find(bar, tmp);
          if (!tmp) return false;
        }
        if (!equal(len[1], bar.get(tmp))) {
          return false;
        }
      }
      return true;
    }

    if (ctor === ArrayBuffer) {
      foo = new Uint8Array(foo);
      bar = new Uint8Array(bar);
    } else if (ctor === DataView) {
      if ((len = foo.byteLength) === bar.byteLength) {
        while (len-- && foo.getInt8(len) === bar.getInt8(len));
      }
      return len === -1;
    }

    if (ArrayBuffer.isView(foo)) {
      if ((len = foo.byteLength) === bar.byteLength) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        while (len-- && foo[len] === bar[len]);
      }
      return len === -1;
    }

    if (!ctor || typeof foo === 'object') {
      len = 0;
      for (ctor in foo) {
        if (has.call(foo, ctor) && ++len && !has.call(bar, ctor)) return false;
        if (!(ctor in bar) || !equal(foo[ctor], bar[ctor])) return false;
      }
      return Object.keys(bar).length === len;
    }
  }

  return foo !== foo && bar !== bar;
};
