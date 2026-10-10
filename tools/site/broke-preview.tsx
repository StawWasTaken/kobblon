/* The page a broken page becomes. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Boundary } from '@/components/layout/Boundary'
import '@/index.css'

function Throws(): never {
  throw new Error("Cannot read properties of null (reading 'until')")
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <Boundary><Throws /></Boundary>
  </MemoryRouter>,
)
