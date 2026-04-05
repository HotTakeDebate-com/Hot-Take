import LegalDocumentShell from './legal/LegalDocumentShell.jsx';

export default function MissionPage({ onBack }) {
  return (
    <LegalDocumentShell title="Our Mission" onBack={onBack}>
      <section className="legal-section">
        <p>
          At Hot Take, our mission is to create a space where meaningful conversation can thrive. We
          believe that open dialogue—when structured with respect, clarity, and purpose—has the
          power to challenge ideas, expand perspectives, and bring people closer to truth.
        </p>
        <p>
          In a world where discussions are often fragmented or driven by noise, Hot Take is built to
          restore thoughtful exchange by encouraging users to engage directly, listen actively, and
          debate constructively.
        </p>
        <p>
          Our goal is not to silence differences, but to elevate them into conversations that are
          productive, insightful, and grounded in mutual respect.
        </p>
      </section>
    </LegalDocumentShell>
  );
}
