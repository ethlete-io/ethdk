declare module '@assets/*?raw' {
  const text: string;
  export default text;
}

declare module '@assets/*' {
  const url: string;
  export default url;
}
