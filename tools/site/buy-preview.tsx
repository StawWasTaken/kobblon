/* The purchase card, with nothing around it and no money anywhere near it. */
import { createRoot } from 'react-dom/client'
import { BuyDialog } from '@/components/catalog/BuyDialog'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-8">
    <BuyDialog
      open
      onClose={() => {}}
      onBuy={() => {}}
      name="Pirate Bicorne"
      kind="Accessory"
      price={45}
      balance={120}
      note="A limited: it stops selling on 30/06/2027."
    />
  </div>,
)
