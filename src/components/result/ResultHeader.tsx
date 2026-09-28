import { ProductHeader } from '@/components/chrome/ProductHeader'

export function ResultHeader() {
  return <ProductHeader variant="result" actions={<span className="result-header__streak" aria-label="Демо: серия 4 дня"><span aria-hidden="true">🔥</span><span>Серия: <strong>4 дня</strong></span></span>} />
}
