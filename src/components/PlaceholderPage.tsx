interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-card">
        <p className="page-eyebrow">
          PROJECT S
        </p>

        <h2>{title}</h2>

        <p>{description}</p>

        <span className="placeholder-badge">
          Module scaffold ready
        </span>
      </div>
    </section>
  );
}