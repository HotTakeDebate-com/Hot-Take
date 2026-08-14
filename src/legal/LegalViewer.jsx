import CommunityGuidelines from './CommunityGuidelines.jsx';
import PrivacyPolicy from './PrivacyPolicy.jsx';
import RecordingAgreement from './RecordingAgreement.jsx';
import TermsOfService from './TermsOfService.jsx';

export default function LegalViewer({ documentId, onBack }) {
  let content = null;
  if (documentId === 'terms') content = <TermsOfService onBack={onBack} />;
  if (documentId === 'privacy') content = <PrivacyPolicy onBack={onBack} />;
  if (documentId === 'community') content = <CommunityGuidelines onBack={onBack} />;
  if (documentId === 'recording') content = <RecordingAgreement onBack={onBack} />;
  if (!content) return null;

  return <div className="legal-viewer-shell">{content}</div>;
}
