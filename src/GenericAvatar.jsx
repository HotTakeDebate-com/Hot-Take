export default function GenericAvatar({ className = '' }) {
  return (
    <svg className={`generic-avatar ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <circle className="generic-avatar-background" cx="32" cy="32" r="32" />
      <circle className="generic-avatar-person" cx="32" cy="22" r="10" />
      <path className="generic-avatar-person" d="M14 56c1.6-13.3 7.6-20 18-20s16.4 6.7 18 20" />
    </svg>
  );
}
