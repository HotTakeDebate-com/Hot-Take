export default function BrandLogo({ className = '' }) {
  return (
    <img
      src="/hottake-logo.png"
      alt="Hot Take"
      className={['brand-logo', className].filter(Boolean).join(' ')}
    />
  );
}
