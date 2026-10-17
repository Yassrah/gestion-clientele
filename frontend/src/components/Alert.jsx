export default function Alert({ type = 'error', message, onClose }) {
  if (!message) return null
  return (
    <div className={`alert alert-${type}`} role="alert">
      {message}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            float: 'right',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
          }}
          aria-label="Fermer"
        >
          ×
        </button>
      )}
    </div>
  )
}
