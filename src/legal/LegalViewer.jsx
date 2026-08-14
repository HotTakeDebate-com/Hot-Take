import { useState } from 'react';
import CommunityGuidelines from './CommunityGuidelines.jsx';
import PrivacyPolicy from './PrivacyPolicy.jsx';
import RecordingAgreement from './RecordingAgreement.jsx';
import TermsOfService from './TermsOfService.jsx';

export default function LegalViewer({ documentId, onBack }) {
  const [activeDocumentId, setActiveDocumentId] = useState(documentId);

  let content = null;
  if (activeDocumentId === 'terms') content = <TermsOfService onBack={onBack} />;
  if (activeDocumentId === 'privacy') content = <PrivacyPolicy onBack={onBack} onPickLegal={setActiveDocumentId} />;
  if (activeDocumentId === 'community') content = <CommunityGuidelines onBack={onBack} />;
  if (activeDocumentId === 'recording') content = <RecordingAgreement onBack={onBack} />;
  if (!content) return null;

  return <div className="legal-viewer-shell">{content}</div>;
}
