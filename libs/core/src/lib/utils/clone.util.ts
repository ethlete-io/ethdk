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
