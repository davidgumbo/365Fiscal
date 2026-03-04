type ValidationAlertProps = {
  message: string | null;
  onClose: () => void;
};

export default function ValidationAlert({
  message,
  onClose,
}: ValidationAlertProps) {
  if (!message) return null;

  return (
    <div
      className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-3"
      role="alert"
      style={{ marginBottom: 16 }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "rgba(220, 53, 69, 0.16)",
          color: "#b91c1c",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zM7 4.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm.93 2.588.2 4.069a.25.25 0 0 1-.25.263h-.86a.25.25 0 0 1-.25-.264l.2-4.068a.25.25 0 0 1 .25-.236h.71a.25.25 0 0 1 .25.236z" />
        </svg>
      </span>
      <span className="flex-fill">{message}</span>
      <button type="button" className="btn-close" onClick={onClose} />
    </div>
  );
}
