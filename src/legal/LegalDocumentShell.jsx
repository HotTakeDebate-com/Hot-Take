import './PrivacyPolicy.css';

export default function LegalDocumentShell({ title, effectiveDate, children, onBack, embedded = false }) {
  const article = (
    <article className={embedded ? 'legal-doc-article legal-doc-article--embedded' : 'legal-doc-article'}>
      <header className="legal-doc-header">
        <h1 className={embedded ? 'legal-doc-title legal-doc-title--embedded' : 'legal-doc-title'}>
          {title}
        </h1>
        {effectiveDate && <p className="legal-doc-meta">Effective date: {effectiveDate}</p>}
      </header>
      {children}
    </article>
  );

  if (embedded) {
    return article;
  }

  return (
    <div className="legal-doc">
      <div className="legal-doc-inner">
        {onBack && (
          <button type="button" className="btn btn-ghost legal-doc-back" onClick={onBack}>
            ← Back
          </button>
        )}
        {article}
      </div>
    </div>
  );
}
