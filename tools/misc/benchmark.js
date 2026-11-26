const { performance } = require('perf_hooks');

const data = [[214.1041717529297, 92.95833587646484, 312.79168701171875, 176.77084350585938, 445, 176.77084350585938]];

const funReduce = () => {
  const index = 0;
  const count = data[index].reduce((acc, cur) => {
    acc[index] = acc[index] + cur;
    return acc;
  }, 0);
};

const funFor = () => {
  const index = 0;

  let count = 0;
  for (let i = 0; i < data[index].length; i++) {
    count += data[index][i];
  }
};

const bench = (fn, name) => {
  let total = 0;

  for (let i = 0; i < 1_000_000; i++) {
    const s = performance.now();
    fn();
    const e = performance.now();

    total += e - s;
  }

  console.log(name, total / 1000);
};

bench(funReduce, 'reduce');
bench(funFor, 'for');
