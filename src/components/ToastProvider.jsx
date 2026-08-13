import { createContext, useCallback, useContext, useState } from 'react'
const ToastContext = createContext(null)
export function ToastProvider({ children }) {
  const [messages, setMessages] = useState([])
  const notify = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID()
    setMessages(items => [...items, { id, message, type }])
    window.setTimeout(() => setMessages(items => items.filter(item => item.id !== id)), 5000)
  }, [])
  return <ToastContext.Provider value={notify}>{children}<div className="toasts" aria-live="polite">{messages.map(item => <div className={`toast ${item.type}`} key={item.id}>{item.message}</div>)}</div></ToastContext.Provider>
}
export const useToast = () => useContext(ToastContext)
