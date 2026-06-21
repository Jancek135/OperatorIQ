/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:     'var(--bg)',
        s1:     'var(--s1)',
        s2:     'var(--s2)',
        s3:     'var(--s3)',
        blue:   'var(--blue)',
        green:  'var(--green)',
        yellow: 'var(--yellow)',
        red:    'var(--red)',
        bdim:   'var(--bdim)',
        gdim:   'var(--gdim)',
        ydim:   'var(--ydim)',
        rdim:   'var(--rdim)',
        text:   'var(--text)',
        muted:  'var(--muted)',
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
}
