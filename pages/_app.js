import { Toaster } from 'react-hot-toast'
import { ProfileProvider } from '../components/ProfileProvider'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <ProfileProvider>
      <Component {...pageProps} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#21262d',
            color: '#e6edf3',
            border: '1px solid #30363d',
            fontFamily: 'Cairo, sans-serif',
            fontSize: '13px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: { primary: '#3fb950', secondary: '#0d1117' },
          },
          error: {
            iconTheme: { primary: '#f85149', secondary: '#0d1117' },
          },
        }}
      />
    </ProfileProvider>
  )
}
