export const OPTIONS = {
  gmVersion: ['pro', 'free'],
} as const;

export type Options = {
  GmVersion: (typeof OPTIONS)['gmVersion'][number];
};
