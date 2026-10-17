/*
 * The loading screen with nothing around it.
 *
 * No router, no session, no toast provider. The Workspace mounts it like
 * this, so this page is where it finds out if that stopped being possible.
 */
import { createRoot } from 'react-dom/client'
import { LoadingScreen } from '@/components/ui/Loading'
import '@/index.css'

createRoot(document.getElementById('root')!).render(<LoadingScreen />)
