import { CONTACT_PARTS, SOURCE_URL } from '../config.ts'

/** Operator contact (FOSSGIS terms) and source link. The address only exists at runtime. */
export function Footer() {
  const address = () => `${CONTACT_PARTS[0]}@${CONTACT_PARTS.slice(1).join('.')}`
  return (
    <footer class="footer">
      Contact:{' '}
      <a
        href="#contact"
        onClick={(e) => {
          e.preventDefault()
          window.location.href = `mailto:${address()}`
        }}
      >
        {address()}
      </a>{' '}
      ·{' '}
      <a href={SOURCE_URL} target="_blank" rel="noopener">
        Source
      </a>
    </footer>
  )
}
