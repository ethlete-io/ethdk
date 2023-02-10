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

export const clone = <T>(y: T): T => {
  if (typeof x !== 'object') return x;

  var x = y as any;

  var i = 0,
    k,
    list,
    tmp: any,
    str = Object.prototype.toString.call(x);

  if (str === '[object Object]') {
    tmp = Object.create(x.__proto__ || null);
  } else if (str === '[object Array]') {
    tmp = Array(x.length);
  } else if (str === '[object Set]') {
    tmp = new Set();
    x.forEach(function (val: any) {
      tmp.add(clone(val));
    });
  } else if (str === '[object Map]') {
    tmp = new Map();
    x.forEach(function (val: any, key: any) {
      tmp.set(clone(key), clone(val));
    });
  } else if (str === '[object Date]') {
    tmp = new Date(+x);
  } else if (str === '[object RegExp]') {
    tmp = new RegExp(x.source, x.flags);
  } else if (str === '[object DataView]') {
    tmp = new x.constructor(clone(x.buffer));
  } else if (str === '[object ArrayBuffer]') {
    tmp = x.slice(0);
  } else if (str.slice(-6) === 'Array]') {
    // ArrayBuffer.isView(x)
    // ~> `new` bcuz `Buffer.slice` => ref
    tmp = new x.constructor(x);
  }

  if (tmp) {
    for (list = Object.getOwnPropertySymbols(x); i < list.length; i++) {
      set(tmp, list[i], Object.getOwnPropertyDescriptor(x, list[i]));
    }

    for (i = 0, list = Object.getOwnPropertyNames(x); i < list.length; i++) {
      if (Object.hasOwnProperty.call(tmp, (k = list[i])) && tmp[k] === x[k]) continue;
      set(tmp, k, Object.getOwnPropertyDescriptor(x, k));
    }
  }

  return tmp || x;
};
