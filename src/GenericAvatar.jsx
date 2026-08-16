export default function GenericAvatar({ className = '' }) {
  return (
    <svg className={`generic-avatar ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="22" r="12" />
      <path d="M11 58c1.8-15.3 9.2-23 21-23s19.2 7.7 21 23" />
    </svg>
  );
}
