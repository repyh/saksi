import Link from "next/link";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#f7f8fa",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section style={{ maxWidth: "28rem", textAlign: "center" }}>
        <p style={{ color: "#1d4ed8", fontWeight: 700, letterSpacing: "0.12em" }}>SAKSI</p>
        <h1 style={{ fontSize: "2rem", margin: "0.5rem 0" }}>You’re offline</h1>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          Reconnect to load the map and submit reports. Drafts saved on this device remain here.
        </p>
        <Link href="/" style={{ color: "#1d4ed8", fontWeight: 600 }}>
          Try again
        </Link>
      </section>
    </main>
  );
}
