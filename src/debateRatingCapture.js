import { auth } from './firebase.js';

if (typeof document !== 'undefined' && !window.__hotTakeRatingCaptureInstalled) {
  window.__hotTakeRatingCaptureInstalled = true;

  document.addEventListener(
    'click',
    async (event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.textContent?.trim() !== 'Submit rating') return;

      const raw = window.localStorage?.getItem('hottake:ratingContext');
      if (!raw) return;

      let context;
      try {
        context = JSON.parse(raw);
      } catch {
        return;
      }

      const selectedStars = Array.from(
        document.querySelectorAll('.debate-rating-star[aria-pressed="true"]')
      );
      const rating = selectedStars.length;
      if (!context?.peerUid || !context?.roomId || rating < 1 || rating > 5) return;

      try {
        const user = auth?.currentUser;
        if (!user) throw new Error('You must be signed in to submit a rating.');
        const token = await user.getIdToken(true);
        const response = await fetch('/api/debate-ratings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ratedUid: context.peerUid,
            rating,
            roomId: context.roomId,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || 'Could not save the debate rating.');

        window.localStorage.removeItem('hottake:ratingContext');
        window.dispatchEvent(
          new CustomEvent('hot-take:rating-updated', {
            detail: { ratedUid: context.peerUid, rating },
          })
        );
      } catch (error) {
        console.error('[hot-take] rating submission failed', error);
        // Keep the context so the user can retry after a transient failure.
      }
    },
    true
  );
}
