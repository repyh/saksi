export default function AppIcon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1d4ed8",
      }}
    >
      <svg width="68%" height="68%" viewBox="0 0 512 512" fill="none" aria-hidden="true">
        <path
          d="M256 452s138-132 138-242a138 138 0 1 0-276 0c0 110 138 242 138 242Z"
          fill="white"
        />
        <circle cx="256" cy="210" r="79" fill="#1d4ed8" />
        <path
          d="M256 153v40m0 35v40m0 35v24"
          stroke="white"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
