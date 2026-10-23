/* The whole website, while the shutters are down. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import Maintenance from '@/pages/Maintenance'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <MemoryRouter>
      <Maintenance note="Moving the Brix ledger. Back by six." />
    </MemoryRouter>
  </ThemeProvider>,
)
