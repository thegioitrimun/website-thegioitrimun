/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
            },
            borderRadius: {
                lg: `var(--radius)`,
                md: `calc(var(--radius) - 2px)`,
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                sans: ['var(--font-sans)', 'sans-serif'],
                heading: ['var(--font-heading)', 'sans-serif'],
            },
            transitionTimingFunction: {
                'custom-bezier': 'cubic-bezier(0.4, 0, 0.2, 1)',
            },
            keyframes: {
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'none' },
                },
                toastIn: {
                    'from': { opacity: '0', transform: 'translateX(100%)' },
                    'to': { opacity: '1', transform: 'translateX(0)' },
                },
                toastOut: {
                    'from': { opacity: '1', transform: 'translateX(0)' },
                    'to': { opacity: '0', transform: 'translateX(100%)' },
                },
                slideInUp: {
                    'from': { transform: 'translateY(100%)' },
                    'to': { transform: 'translateY(0)' },
                },
                slideOutDown: {
                    'from': { transform: 'translateY(0)' },
                    'to': { transform: 'translateY(100%)' },
                },
                fadeIn: {
                    'from': { opacity: '0' },
                    'to': { opacity: '1' },
                },
                fadeOut: {
                    'from': { opacity: '1' },
                    'to': { opacity: '0' },
                },
                fadeInPage: {
                    'from': { opacity: '0', transform: 'translateY(15px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                'toast-in': 'toastIn 0.4s cubic-bezier(0.21, 1.02, 0.73, 1) forwards',
                'toast-out': 'toastOut 0.4s cubic-bezier(0.21, 1.02, 0.73, 1) forwards',
                'slide-in-up': 'slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                'slide-out-down': 'slideOutDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                'fade-in': 'fadeIn 0.2s ease-out',
                'fade-out': 'fadeOut 0.2s ease-in',
                'fade-in-page': 'fadeInPage 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }
        },
    }
}
