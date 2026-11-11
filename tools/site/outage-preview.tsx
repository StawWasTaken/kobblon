import { MemoryRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import Maintenance from '@/pages/Maintenance'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Maintenance outage /></MemoryRouter>,
)
