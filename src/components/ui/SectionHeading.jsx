export default function SectionHeading({eyebrow,title,action,onAction}){
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action&&(
        <button type="button" className="text-button" onClick={onAction}>
          {action} →
        </button>
      )}
    </div>
  );
}
