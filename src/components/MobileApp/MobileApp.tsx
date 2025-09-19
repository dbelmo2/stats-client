import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import H3LatenessDashboard from './components/H3LatenessDashboard';

// Create a theme instance
const theme = createTheme({
  palette: {
    mode: 'dark', // Dark mode by default
    primary: {
      main: '#7462b3', // Using the same purple from your bug report UI
    },
    secondary: {
      main: '#28a745', // Green from your success message
    },
    background: {
      default: '#121212',
      paper: '#1a1a1a',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
});

export function MobileApp() {


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* This normalizes the styles */}
        <H3LatenessDashboard />
    </ThemeProvider>
  );
}