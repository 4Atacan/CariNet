/**
 * Gorsel varliklarin modul tanimi.
 *
 * Metro bundler `import logo from './logo.png'` bicimini destekler ve `Image source` icin gereken
 * sayiyi/nesneyi dondurur, ama TypeScript bunu bilmez — `expo/types` de png tanimlamiyor (denendi:
 * TS2307). Alternatif `require()` idi; ESLint (`no-require-imports`) onu reddediyor. Tanim burada.
 */
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}

declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native';
  const content: ImageSourcePropType;
  export default content;
}
