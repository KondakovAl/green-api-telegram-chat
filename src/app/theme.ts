import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'green',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '700',
  },
  colors: {
    green: [
      '#f0f9ed',
      '#e1f1dc',
      '#c3e3b8',
      '#a2d492',
      '#7fc369',
      '#5dbb38',
      '#348f16',
      '#2d7e13',
      '#256a10',
      '#1d570c',
    ],
  },
});
