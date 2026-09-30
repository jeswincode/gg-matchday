export default function AccessDenied({title,description,signIn,request,pending}) {
  return (
    <section className="access-denied">
      <div className="access-icon">🔒</div>
      <p className="eyebrow">RESTRICTED</p>
      <h2>{title}</h2>
      <p>{description}</p>

      {signIn && (
        <button type="button" className="google-button" onClick={signIn}>
          Continue with Google
        </button>
      )}

      {request && !pending && (
        <button type="button" className="secondary-button" onClick={request}>
          Request Editor Access
        </button>
      )}

      {pending && (
        <span className="request-pending">
          Your editor request is pending approval.
        </span>
      )}
    </section>
  );
}
