/**
 * Post-submit confirmation.
 *
 * A submission takes one of two paths, and the ID the scout should keep differs by
 * path — so the page reads off `warehouseId` rather than assuming either one:
 *
 * - Auto-approved (autopilot on): the entry is already published to the master
 *   warehouse list, so we show its numeric **Warehouse ID**.
 * - Queued for review (autopilot off, or strict validation left it pending): there is
 *   no warehouse yet, so we show the staging **Reference ID** and say so plainly.
 *
 * `warehouseId` presence is the signal, not `autoApproved` — the flag is a
 * convenience, the id is the thing that has to exist for the copy to be true.
 */
function SuccessPage({ warehouseId, submissionId, onStartOver }) {
  const published = warehouseId != null;

  return (
    <div className="success-page">
      <div className="success-page__card">
        <div className="success-page__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="success-page__title">
          {published ? 'Warehouse submitted' : 'Submitted for review'}
        </h2>
        <p className="success-page__subtitle">
          {published
            ? 'The warehouse has been created successfully.'
            : 'A reviewer will approve this before it goes live.'}
        </p>

        <div className="success-page__id-block">
          <span className="success-page__id-label">
            {published ? 'Warehouse ID' : 'Reference ID'}
          </span>
          <span
            className={
              published
                ? 'success-page__id-value'
                : 'success-page__id-value success-page__id-value--reference'
            }
          >
            {(published ? warehouseId : submissionId) ?? '—'}
          </span>
        </div>

        <button
          type="button"
          className="form-btn form-btn--primary success-page__cta"
          onClick={onStartOver}
        >
          Submit another warehouse
        </button>
      </div>
    </div>
  );
}

export default SuccessPage;
